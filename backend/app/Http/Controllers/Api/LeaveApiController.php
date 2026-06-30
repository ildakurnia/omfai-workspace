<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Helpers\WhatsAppHelper;
use App\Models\LeaveRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;

class LeaveApiController extends Controller
{
    /**
     * Submit a leave or permission request.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'type' => 'required|in:annual_leave,sick_leave,permission',
            'start_date' => 'required|date|after_or_equal:today',
            'end_date' => 'required|date|after_or_equal:start_date',
            'reason' => 'required|string',
            'attachment' => 'nullable|file|mimes:jpeg,png,jpg,pdf|max:2048',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error.',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = Auth::user();
        $employee = $user->employee;

        if (!$employee) {
            return response()->json([
                'success' => false,
                'message' => 'Employee profile not found.'
            ], 404);
        }

        $type = $request->type;
        $startDate = Carbon::parse($request->start_date);
        $endDate = Carbon::parse($request->end_date);
        $requestedDays = $startDate->diffInDays($endDate) + 1;

        // Overlapping leave requests check (Pending or Approved)
        $overlappingLeave = LeaveRequest::where('employee_id', $employee->id)
            ->whereIn('status', ['pending', 'approved'])
            ->where('start_date', '<=', $request->end_date)
            ->where('end_date', '>=', $request->start_date)
            ->exists();

        if ($overlappingLeave) {
            return response()->json([
                'success' => false,
                'message' => 'Anda sudah memiliki pengajuan cuti/izin yang sedang diajukan atau disetujui pada tanggal tersebut.'
            ], 422);
        }

        // Check if employee already has attendance records in the requested date range
        $hasAttendance = \App\Models\Attendance::where('employee_id', $employee->id)
            ->whereBetween('date', [$request->start_date, $request->end_date])
            ->exists();

        if ($hasAttendance) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak dapat mengajukan cuti/izin pada tanggal di mana Anda sudah melakukan absensi masuk.'
            ], 422);
        }

        // 1. Annual Leave Rule Check
        if ($type === 'annual_leave') {
            // Tenure check (minimum 12 months from joined_at)
            if (empty($employee->joined_at)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Employee joined date is not set.'
                ], 400);
            }

            $joinedAt = Carbon::parse($employee->joined_at);
            $tenureInMonths = $joinedAt->diffInMonths(Carbon::now());

            if ($tenureInMonths < 12) {
                return response()->json([
                    'success' => false,
                    'message' => 'You are not eligible for Annual Leave. A minimum tenure of 1 year (12 months) is required.'
                ], 403);
            }

            // Balance check
            if ($requestedDays > $employee->leave_balance) {
                return response()->json([
                    'success' => false,
                    'message' => "Insufficient annual leave balance. You requested {$requestedDays} days but only have {$employee->leave_balance} days remaining."
                ], 403);
            }
        }

        // 2. Sick Leave Rule Check (Requires BPJS or general clinic doctor's note)
        if ($type === 'sick_leave') {
            if (!$request->hasFile('attachment')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Sick leave requires a BPJS/Clinic medical certificate upload.'
                ], 422);
            }
        }

        // 3. Permission Rule Check (Requires at least 10 characters explanation)
        if ($type === 'permission') {
            if (strlen(trim($request->reason)) < 10) {
                return response()->json([
                    'success' => false,
                    'message' => 'Permission reason must be descriptive and contain at least 10 characters.'
                ], 422);
            }
        }

        // Upload attachment if present
        $attachmentPath = null;
        if ($request->hasFile('attachment')) {
            $attachmentPath = $request->file('attachment')->store('leave_attachments', 'public');
        }

        // Save Leave Request
        $leaveRequest = LeaveRequest::create([
            'employee_id' => $employee->id,
            'type' => $type,
            'start_date' => $request->start_date,
            'end_date' => $request->end_date,
            'reason' => $request->reason,
            'attachment' => $attachmentPath,
            'status' => 'pending',
        ]);

        // 4. Send WhatsApp Notification to Owner
        $ownerNumber = env('WA_OWNER_NUMBER');
        if (!empty($ownerNumber)) {
            $typeLabel = str_replace('_', ' ', ucfirst($type));
            $formattedStart = $startDate->format('d M Y');
            $formattedEnd = $endDate->format('d M Y');
            
            $waMessage = "*[Omfai Workspace - Pengajuan Cuti/Izin Baru]*\n\n"
                . "Detail Pengajuan:\n"
                . "• Nama: {$employee->name}\n"
                . "• Employee ID: {$employee->employee_code}\n"
                . "• Tipe: {$typeLabel}\n"
                . "• Durasi: {$formattedStart} s/d {$formattedEnd} ({$requestedDays} hari)\n"
                . "• Alasan: {$request->reason}\n"
                . "• Status: Pending\n\n"
                . "Mohon cek Dashboard Admin Omfai untuk memberikan persetujuan.";

            WhatsAppHelper::sendMessage($ownerNumber, $waMessage);
        }

        return response()->json([
            'success' => true,
            'message' => 'Leave request submitted successfully.',
            'data' => $leaveRequest
        ], 201);
    }

    /**
     * Get leave request history for the authenticated employee.
     */
    public function history()
    {
        $user = Auth::user();
        $employee = $user->employee;

        if (!$employee) {
            return response()->json([
                'success' => false,
                'message' => 'Employee profile not found.'
            ], 404);
        }

        $history = LeaveRequest::where('employee_id', $employee->id)
            ->orderBy('created_at', 'desc')
            ->get();
        $isEligible = false;
        if (!empty($employee->joined_at)) {
            $joinedAt = Carbon::parse($employee->joined_at);
            $tenureInMonths = $joinedAt->diffInMonths(Carbon::now());
            $isEligible = $tenureInMonths >= 12;
        }

        return response()->json([
            'success' => true,
            'leave_balance' => $employee->leave_balance,
            'is_eligible' => $isEligible,
            'data' => $history
        ]);
    }

    /**
     * Cancel a pending leave request.
     */
    public function cancel($id)
    {
        $user = Auth::user();
        $employee = $user->employee;

        if (!$employee) {
            return response()->json([
                'success' => false,
                'message' => 'Employee profile not found.'
            ], 404);
        }

        $leaveRequest = LeaveRequest::find($id);

        if (!$leaveRequest) {
            return response()->json([
                'success' => false,
                'message' => 'Pengajuan cuti/izin tidak ditemukan.'
            ], 404);
        }

        // Verify ownership
        if ($leaveRequest->employee_id !== $employee->id) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki otoritas untuk membatalkan pengajuan ini.'
            ], 403);
        }

        // Only allow cancellation of pending requests
        if ($leaveRequest->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Pengajuan tidak dapat dibatalkan karena sudah diproses (Status: ' . $leaveRequest->status . ').'
            ], 422);
        }

        // Update status to cancelled
        $leaveRequest->update([
            'status' => 'cancelled'
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan cuti/izin berhasil dibatalkan.',
            'data' => $leaveRequest
        ]);
    }
}
