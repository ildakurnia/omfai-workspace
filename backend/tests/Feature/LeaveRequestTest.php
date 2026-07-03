<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class LeaveRequestTest extends TestCase
{
    use RefreshDatabase;

    protected $ownerUser;
    protected $oldEmployeeUser;
    protected $oldEmployee;
    protected $newEmployeeUser;
    protected $newEmployee;

    protected function setUp(): void
    {
        parent::setUp();

        // Run RoleSeeder to create roles
        $this->seed(RoleSeeder::class);

        // Fake public storage for uploads
        Storage::fake('public');

        // Create owner user
        $this->ownerUser = User::factory()->create();
        $this->ownerUser->assignRole('Owner');

        // Create old employee (>1 year service)
        $this->oldEmployeeUser = User::factory()->create();
        $this->oldEmployeeUser->assignRole('Employee');
        $this->oldEmployee = Employee::create([
            'user_id' => $this->oldEmployeeUser->id,
            'name' => 'Old Employee',
            'joined_at' => Carbon::now()->subYears(2)->format('Y-m-d'),
            'whatsapp_number' => '628123456781',
            'leave_balance' => 12,
        ]);

        // Create new employee (<1 year service)
        $this->newEmployeeUser = User::factory()->create();
        $this->newEmployeeUser->assignRole('Employee');
        $this->newEmployee = Employee::create([
            'user_id' => $this->newEmployeeUser->id,
            'name' => 'New Employee',
            'joined_at' => Carbon::now()->subMonths(3)->format('Y-m-d'),
            'whatsapp_number' => '628123456782',
            'leave_balance' => 12,
        ]);
    }

    /**
     * Test annual leave fails for new employee (<1 year tenure).
     */
    public function test_annual_leave_fails_for_new_employee()
    {
        $response = $this->actingAs($this->newEmployeeUser)
            ->postJson('/api/ajukan-cuti', [
                'type' => 'annual_leave',
                'start_date' => Carbon::now()->addDays(5)->format('Y-m-d'),
                'end_date' => Carbon::now()->addDays(7)->format('Y-m-d'),
                'reason' => 'Want to go on a vacation.',
            ]);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'You are not eligible for Annual Leave. A minimum tenure of 1 year (12 months) is required.'
            ]);
    }

    /**
     * Test annual leave succeeds for old employee (>=1 year tenure).
     */
    public function test_annual_leave_succeeds_for_eligible_employee()
    {
        $response = $this->actingAs($this->oldEmployeeUser)
            ->postJson('/api/ajukan-cuti', [
                'type' => 'annual_leave',
                'start_date' => Carbon::now()->addDays(5)->format('Y-m-d'),
                'end_date' => Carbon::now()->addDays(6)->format('Y-m-d'), // 2 days
                'reason' => 'Going to hometown for holiday.',
            ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Leave request submitted successfully.'
            ]);

        $this->assertDatabaseHas('leave_requests', [
            'employee_id' => $this->oldEmployee->id,
            'type' => 'annual_leave',
            'status' => 'pending',
        ]);
    }

    public function test_annual_leave_fails_if_exceeding_balance()
    {
        // Request 30 days of leave (will definitely exceed 12 days balance even with weekend exclusions)
        $response = $this->actingAs($this->oldEmployeeUser)
            ->postJson('/api/ajukan-cuti', [
                'type' => 'annual_leave',
                'start_date' => Carbon::now()->addDays(1)->format('Y-m-d'),
                'end_date' => Carbon::now()->addDays(30)->format('Y-m-d'),
                'reason' => 'Very long trip.',
            ]);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
            ]);
    }

    /**
     * Test sick leave fails without attachment.
     */
    public function test_sick_leave_fails_without_attachment()
    {
        $response = $this->actingAs($this->oldEmployeeUser)
            ->postJson('/api/ajukan-cuti', [
                'type' => 'sick_leave',
                'start_date' => Carbon::now()->addDays(1)->format('Y-m-d'),
                'end_date' => Carbon::now()->addDays(2)->format('Y-m-d'),
                'reason' => 'Fever and cold.',
            ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Sick leave requires a BPJS/Clinic medical certificate upload.'
            ]);
    }

    /**
     * Test sick leave succeeds with attachment.
     */
    public function test_sick_leave_succeeds_with_attachment()
    {
        $file = UploadedFile::fake()->create('doctor_note.jpg', 500);

        $response = $this->actingAs($this->oldEmployeeUser)
            ->postJson('/api/ajukan-cuti', [
                'type' => 'sick_leave',
                'start_date' => Carbon::now()->addDays(1)->format('Y-m-d'),
                'end_date' => Carbon::now()->addDays(2)->format('Y-m-d'),
                'reason' => 'Fever and cold.',
                'attachment' => $file,
            ]);

        $response->assertStatus(201);

        $request = LeaveRequest::first();
        $this->assertNotNull($request->attachment);
        Storage::disk('public')->assertExists($request->attachment);
    }

    /**
     * Test permission fails if reason is too short (<10 chars).
     */
    public function test_permission_fails_if_reason_too_short()
    {
        $response = $this->actingAs($this->oldEmployeeUser)
            ->postJson('/api/ajukan-cuti', [
                'type' => 'permission',
                'start_date' => Carbon::now()->addDays(1)->format('Y-m-d'),
                'end_date' => Carbon::now()->addDays(1)->format('Y-m-d'),
                'reason' => 'Short', // Less than 10 characters
            ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Permission reason must be descriptive and contain at least 10 characters.'
            ]);
    }

    public function test_approval_decrements_leave_balance_for_annual_leave()
    {
        $start = Carbon::parse('next monday')->format('Y-m-d');
        $end = Carbon::parse('next tuesday')->format('Y-m-d');

        // 1. Submit a pending annual leave request (2 days)
        $leaveRequest = LeaveRequest::create([
            'employee_id' => $this->oldEmployee->id,
            'type' => 'annual_leave',
            'start_date' => $start,
            'end_date' => $end,
            'reason' => 'Going to hometown.',
            'status' => 'pending',
        ]);

        // 2. Approve via owner user
        $response = $this->actingAs($this->ownerUser)
            ->postJson("/api/leave-requests/{$leaveRequest->id}/approve");

        $response->assertStatus(200);
        $this->assertEquals('approved', $leaveRequest->refresh()->status);
        
        // 12 days default - 2 days = 10 days remaining
        $this->assertEquals(10.0, $this->oldEmployee->refresh()->leave_balance);
    }

    /**
     * Test rejection requires a reason.
     */
    public function test_rejection_requires_reason()
    {
        $leaveRequest = LeaveRequest::create([
            'employee_id' => $this->oldEmployee->id,
            'type' => 'permission',
            'start_date' => Carbon::now()->addDays(5)->format('Y-m-d'),
            'end_date' => Carbon::now()->addDays(5)->format('Y-m-d'),
            'reason' => 'Some permission reason longer than 10 characters.',
            'status' => 'pending',
        ]);

        $response = $this->actingAs($this->ownerUser)
            ->postJson("/api/leave-requests/{$leaveRequest->id}/reject", []);

        $response->assertStatus(422);

        $responseWithReason = $this->actingAs($this->ownerUser)
            ->postJson("/api/leave-requests/{$leaveRequest->id}/reject", [
                'rejection_reason' => 'Busy day, cannot approve permissions.'
            ]);

        $responseWithReason->assertStatus(200);
        $this->assertEquals('rejected', $leaveRequest->refresh()->status);
        $this->assertEquals('Busy day, cannot approve permissions.', $leaveRequest->rejection_reason);
    }

    /**
     * Test employee code auto-generation.
     */
    public function test_employee_code_auto_generation()
    {
        $employeeUser = User::factory()->create();
        $employeeUser->assignRole('Employee');
        
        $employee = Employee::create([
            'user_id' => $employeeUser->id,
            'name' => 'Jane Doe',
            'joined_at' => '2026-08-15',
            'whatsapp_number' => '628999999999',
            'leave_balance' => 12,
        ]);

        $this->assertEquals('2026081503', $employee->employee_code);

        // Create another employee on the same day
        $employeeUser2 = User::factory()->create();
        $employeeUser2->assignRole('Employee');

        $employee2 = Employee::create([
            'user_id' => $employeeUser2->id,
            'name' => 'Jimmy Doe',
            'joined_at' => '2026-08-15',
            'whatsapp_number' => '628999999998',
            'leave_balance' => 12,
        ]);

        $this->assertEquals('2026081504', $employee2->employee_code);
    }

    /**
     * Test list all leave requests (Admin/Owner only).
     */
    public function test_list_all_leave_requests()
    {
        // 1. Create a pending request
        LeaveRequest::create([
            'employee_id' => $this->oldEmployee->id,
            'type' => 'permission',
            'start_date' => Carbon::now()->addDays(5)->format('Y-m-d'),
            'end_date' => Carbon::now()->addDays(5)->format('Y-m-d'),
            'reason' => 'Some permission reason longer than 10 characters.',
            'status' => 'pending',
        ]);

        // 2. Fetch as employee (should be unauthorized)
        $responseEmployee = $this->actingAs($this->oldEmployeeUser)
            ->getJson('/api/leave-requests');
        $responseEmployee->assertStatus(403);

        // 3. Fetch as owner (should be success)
        $responseOwner = $this->actingAs($this->ownerUser)
            ->getJson('/api/leave-requests');
        $responseOwner->assertStatus(200)
            ->assertJsonCount(1, 'data');
    }

    /**
     * Test leave request fails if employee already checked-in on requested dates.
     */
    public function test_leave_request_fails_if_already_checked_in()
    {
        $today = Carbon::now()->format('Y-m-d');

        // Create attendance check-in for today
        \App\Models\Attendance::create([
            'employee_id' => $this->oldEmployee->id,
            'date' => $today,
            'check_in' => '08:00:00',
            'status' => 'present',
        ]);

        $response = $this->actingAs($this->oldEmployeeUser)
            ->postJson('/api/ajukan-cuti', [
                'type' => 'permission',
                'start_date' => $today,
                'end_date' => $today,
                'reason' => 'Some permission reason longer than 10 chars.',
            ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Anda tidak dapat mengajukan cuti/izin pada tanggal di mana Anda sudah melakukan absensi masuk.'
            ]);
    }

    /**
     * Test leave request fails if overlaps existing pending or approved leave request.
     */
    public function test_leave_request_fails_if_overlaps_existing()
    {
        $startDate = Carbon::now()->addDays(15)->format('Y-m-d');
        $endDate = Carbon::now()->addDays(17)->format('Y-m-d');

        // Create existing approved request
        LeaveRequest::create([
            'employee_id' => $this->oldEmployee->id,
            'type' => 'permission',
            'start_date' => $startDate,
            'end_date' => $endDate,
            'reason' => 'Existing permission reasons.',
            'status' => 'approved',
        ]);

        // Try to request overlapping date range
        $response = $this->actingAs($this->oldEmployeeUser)
            ->postJson('/api/ajukan-cuti', [
                'type' => 'permission',
                'start_date' => Carbon::now()->addDays(16)->format('Y-m-d'),
                'end_date' => Carbon::now()->addDays(18)->format('Y-m-d'),
                'reason' => 'Overlapping permission reasons.',
            ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Anda sudah memiliki pengajuan cuti/izin yang sedang diajukan atau disetujui pada tanggal tersebut.'
            ]);
    }

    /**
     * Test delete leave request succeeds and refunds balance if approved annual leave.
     */
    public function test_delete_leave_request_succeeds()
    {
        $startDate = Carbon::parse('next monday')->addWeeks(4)->format('Y-m-d');
        $endDate = Carbon::parse('next tuesday')->addWeeks(4)->format('Y-m-d'); // 2 days

        // Create approved annual leave request
        $leaveRequest = LeaveRequest::create([
            'employee_id' => $this->oldEmployee->id,
            'type' => 'annual_leave',
            'start_date' => $startDate,
            'end_date' => $endDate,
            'reason' => 'Annual leave reasons.',
            'status' => 'approved',
        ]);

        // Adjust initial balance to simulate deduction
        $this->oldEmployee->decrement('leave_balance', 2);
        $this->assertEquals(10.0, $this->oldEmployee->fresh()->leave_balance);

        // Delete as owner
        $response = $this->actingAs($this->ownerUser)
            ->deleteJson("/api/leave-requests/{$leaveRequest->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Leave request deleted/cancelled successfully.'
            ]);

        // Verify balance refunded and record deleted
        $this->assertEquals(12.0, $this->oldEmployee->fresh()->leave_balance);
        $this->assertDatabaseMissing('leave_requests', ['id' => $leaveRequest->id]);
    }

    /**
     * Test Saturday counts as 0.5 days, Sunday & public holidays count as 0.0, Weekdays count as 1.0.
     */
    public function test_leave_duration_calculation_rules()
    {
        // 1. Monday to Saturday (5 weekdays + 1 Saturday) = 5.5 days
        $monToSat = LeaveRequest::create([
            'employee_id' => $this->oldEmployee->id,
            'type' => 'annual_leave',
            'start_date' => '2026-07-06', // Monday
            'end_date' => '2026-07-11', // Saturday
            'reason' => 'Test',
        ]);
        $this->assertEquals(5.5, $monToSat->duration_days);

        // 2. Saturday only = 0.5 days
        $satOnly = LeaveRequest::create([
            'employee_id' => $this->oldEmployee->id,
            'type' => 'annual_leave',
            'start_date' => '2026-07-11', // Saturday
            'end_date' => '2026-07-11', // Saturday
            'reason' => 'Test',
        ]);
        $this->assertEquals(0.5, $satOnly->duration_days);

        // 3. Sunday only = 0.0 days
        $sunOnly = LeaveRequest::create([
            'employee_id' => $this->oldEmployee->id,
            'type' => 'annual_leave',
            'start_date' => '2026-07-12', // Sunday
            'end_date' => '2026-07-12', // Sunday
            'reason' => 'Test',
        ]);
        $this->assertEquals(0.0, $sunOnly->duration_days);

        // 4. Including public holiday (2026-07-07 Tuesday)
        \App\Models\Holiday::create([
            'name' => 'Test Holiday',
            'date' => '2026-07-07',
        ]);

        // Monday 2026-07-06 to Wednesday 2026-07-08
        // Normally 3 days, but Tuesday is a holiday, so 2 days.
        $withHoliday = LeaveRequest::create([
            'employee_id' => $this->oldEmployee->id,
            'type' => 'annual_leave',
            'start_date' => '2026-07-06',
            'end_date' => '2026-07-08',
            'reason' => 'Test',
        ]);
        $this->assertEquals(2.0, $withHoliday->duration_days);
    }
}
