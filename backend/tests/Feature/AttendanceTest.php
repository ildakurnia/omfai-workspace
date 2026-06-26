<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\Employee;
use App\Models\Geofence;
use App\Models\Holiday;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class AttendanceTest extends TestCase
{
    use RefreshDatabase;

    protected $employeeUser;
    protected $employee;
    protected $geofence;

    protected function setUp(): void
    {
        parent::setUp();

        // Run RoleSeeder to create roles
        $this->seed(RoleSeeder::class);

        // Create an employee user
        $this->employeeUser = User::factory()->create([
            'name' => 'John Doe',
            'email' => 'john@omfai.com',
            'password' => bcrypt('password'),
        ]);
        $this->employeeUser->assignRole('Employee');

        // Create the employee profile
        $this->employee = Employee::create([
            'user_id' => $this->employeeUser->id,
            'name' => 'John Doe',
            'joined_at' => '2025-01-01',
            'whatsapp_number' => '628123456789',
            'leave_balance' => 12,
        ]);

        // Create a default geofence (e.g. Omfai Office)
        // Latitude: -6.200000, Longitude: 106.800000, Radius: 100 meters
        $this->geofence = Geofence::create([
            'name' => 'Omfai Head Office',
            'latitude' => -6.200000,
            'longitude' => 106.800000,
            'radius' => 100, // 100 meters
        ]);
    }

    /**
     * Test check-in fails if coordinates are outside geofence.
     */
    public function test_check_in_fails_outside_geofence()
    {
        // Coordinates far away from office
        $response = $this->actingAs($this->employeeUser)
            ->postJson('/api/absen', [
                'latitude' => -6.300000,
                'longitude' => 106.900000,
            ]);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'You are outside the allowed geofence area.'
            ]);
    }

    /**
     * Test check-in succeeds inside geofence when on weekday and within valid times.
     */
    public function test_check_in_succeeds_inside_geofence()
    {
        // Mock current time to Tuesday 07:30 AM (Weekday, normal check-in)
        Carbon::setTestNow(Carbon::parse('2026-06-23 07:30:00'));

        $response = $this->actingAs($this->employeeUser)
            ->postJson('/api/absen', [
                'latitude' => -6.200050,
                'longitude' => 106.800050,
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Successfully checked in. Status: Present'
            ]);

        $this->assertDatabaseHas('attendances', [
            'employee_id' => $this->employee->id,
            'date' => '2026-06-23',
            'status' => 'present',
        ]);

        Carbon::setTestNow();
    }

    /**
     * Test check-in status is marked as 'late' when check-in is after 08:00 AM.
     */
    public function test_check_in_marked_late_after_eight_am()
    {
        // Mock time to Tuesday 08:15 AM
        Carbon::setTestNow(Carbon::parse('2026-06-23 08:15:00'));

        $response = $this->actingAs($this->employeeUser)
            ->postJson('/api/absen', [
                'latitude' => -6.200000,
                'longitude' => 106.800000,
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Successfully checked in. Status: Late'
            ]);

        $this->assertDatabaseHas('attendances', [
            'employee_id' => $this->employee->id,
            'date' => '2026-06-23',
            'status' => 'late',
        ]);

        Carbon::setTestNow();
    }

    /**
     * Test check-in fails on Sunday.
     */
    public function test_check_in_fails_on_sunday()
    {
        // Mock Sunday 07:30 AM
        Carbon::setTestNow(Carbon::parse('2026-06-28 07:30:00'));

        $response = $this->actingAs($this->employeeUser)
            ->postJson('/api/absen', [
                'latitude' => -6.200000,
                'longitude' => 106.800000,
            ]);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Attendance rejected. Sunday is a rest day.'
            ]);

        Carbon::setTestNow();
    }

    /**
     * Test check-in fails on Public Holiday.
     */
    public function test_check_in_fails_on_public_holiday()
    {
        // Create a holiday
        Holiday::create([
            'date' => '2026-06-23',
            'name' => 'Independence Day Mock',
            'is_custom' => false
        ]);

        // Mock Tuesday 2026-06-23 (Holiday)
        Carbon::setTestNow(Carbon::parse('2026-06-23 07:30:00'));

        $response = $this->actingAs($this->employeeUser)
            ->postJson('/api/absen', [
                'latitude' => -6.200000,
                'longitude' => 106.800000,
            ]);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Attendance rejected. Today is a public holiday.'
            ]);

        Carbon::setTestNow();
    }

    /**
     * Test check-out locked before shift end.
     */
    public function test_check_out_locked_before_shift_end()
    {
        // 1. Check in first
        Attendance::create([
            'employee_id' => $this->employee->id,
            'date' => '2026-06-23',
            'check_in' => '07:30:00',
            'status' => 'present'
        ]);

        // 2. Attempt check-out at 15:00 PM (Shift ends at 17:00 PM on weekdays)
        Carbon::setTestNow(Carbon::parse('2026-06-23 15:00:00'));

        $response = $this->actingAs($this->employeeUser)
            ->postJson('/api/absen', [
                'latitude' => -6.200000,
                'longitude' => 106.800000,
            ]);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Check-out is locked until 17:00.'
            ]);

        Carbon::setTestNow();
    }

    /**
     * Test check-out succeeds after shift end.
     */
    public function test_check_out_succeeds_after_shift_end()
    {
        // 1. Create a checked-in attendance
        $attendance = Attendance::create([
            'employee_id' => $this->employee->id,
            'date' => '2026-06-23',
            'check_in' => '07:30:00',
            'status' => 'present'
        ]);

        // 2. Attempt check-out at 17:05 PM
        Carbon::setTestNow(Carbon::parse('2026-06-23 17:05:00'));

        $response = $this->actingAs($this->employeeUser)
            ->postJson('/api/absen', [
                'latitude' => -6.200000,
                'longitude' => 106.800000,
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Successfully checked out.'
            ]);

        $this->assertNotNull($attendance->refresh()->check_out);

        Carbon::setTestNow();
    }

    /**
     * Test Admin can create, update, and delete geofences.
     */
    public function test_admin_can_manage_geofences()
    {
        $adminUser = User::factory()->create();
        $adminUser->assignRole('Admin');

        // 1. Create Geofence
        $responseCreate = $this->actingAs($adminUser)
            ->postJson('/api/geofences', [
                'name' => 'New Office Branch',
                'latitude' => -6.500000,
                'longitude' => 106.500000,
                'radius' => 200,
            ]);

        $responseCreate->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Geofence location created successfully.'
            ]);

        $geofenceId = $responseCreate->json('data.id');

        // 2. Update Geofence
        $responseUpdate = $this->actingAs($adminUser)
            ->putJson("/api/geofences/{$geofenceId}", [
                'name' => 'Updated Office Branch',
                'latitude' => -6.550000,
                'longitude' => 106.550000,
                'radius' => 300,
            ]);

        $responseUpdate->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Geofence location updated successfully.'
            ]);

        // 3. Delete Geofence
        $responseDelete = $this->actingAs($adminUser)
            ->deleteJson("/api/geofences/{$geofenceId}");

        $responseDelete->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Geofence location deleted successfully.'
            ]);
    }

    /**
     * Test Employee cannot manage geofences.
     */
    public function test_employee_cannot_manage_geofences()
    {
        $responseCreate = $this->actingAs($this->employeeUser)
            ->postJson('/api/geofences', [
                'name' => 'Unauthorized Office',
                'latitude' => -6.500000,
                'longitude' => 106.500000,
                'radius' => 200,
            ]);

        $responseCreate->assertStatus(403);
    }

    /**
     * Test Admin can delete an attendance record.
     */
    public function test_admin_can_delete_attendance()
    {
        $adminUser = User::factory()->create();
        $adminUser->assignRole('Admin');

        $attendance = Attendance::create([
            'employee_id' => $this->employee->id,
            'date' => '2026-06-23',
            'check_in' => '07:30:00',
            'status' => 'present',
        ]);

        $response = $this->actingAs($adminUser)
            ->deleteJson("/api/attendances/{$attendance->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Attendance record deleted successfully.'
            ]);

        $this->assertDatabaseMissing('attendances', [
            'id' => $attendance->id,
        ]);
    }

    /**
     * Test Employee cannot delete an attendance record.
     */
    public function test_employee_cannot_delete_attendance()
    {
        $attendance = Attendance::create([
            'employee_id' => $this->employee->id,
            'date' => '2026-06-23',
            'check_in' => '07:30:00',
            'status' => 'present',
        ]);

        $response = $this->actingAs($this->employeeUser)
            ->deleteJson("/api/attendances/{$attendance->id}");

        $response->assertStatus(403);
    }

    /**
     * Test Owner cannot delete an attendance record.
     */
    public function test_owner_cannot_delete_attendance()
    {
        $ownerUser = User::factory()->create();
        $ownerUser->assignRole('Owner');

        $attendance = Attendance::create([
            'employee_id' => $this->employee->id,
            'date' => '2026-06-23',
            'check_in' => '07:30:00',
            'status' => 'present',
        ]);

        $response = $this->actingAs($ownerUser)
            ->deleteJson("/api/attendances/{$attendance->id}");

        $response->assertStatus(403);
    }

    /**
     * Test check-in fails if employee is on approved leave today.
     */
    public function test_check_in_fails_when_on_approved_leave()
    {
        // Mock current time to Tuesday 07:30 AM
        Carbon::setTestNow(Carbon::parse('2026-06-23 07:30:00'));
        $today = '2026-06-23';

        // Create approved leave request for today
        \App\Models\LeaveRequest::create([
            'employee_id' => $this->employee->id,
            'type' => 'permission',
            'start_date' => $today,
            'end_date' => $today,
            'reason' => 'Doctor appointment.',
            'status' => 'approved',
        ]);

        $response = $this->actingAs($this->employeeUser)
            ->postJson('/api/absen', [
                'latitude' => -6.200050,
                'longitude' => 106.800050,
            ]);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Attendance rejected. You are on approved leave today.'
            ]);
    }
}
