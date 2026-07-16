<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Helpers\WhatsAppHelper;
use App\Models\LeaveRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class LeaveApprovalController extends Controller
{
    /**
     * List all leave requests (Admin/Owner only).
     */
    public function index(Request $request)
    {
        $user = Auth::user();

        if (!$user->hasRole('Owner') && !$user->hasRole('Admin')) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only Owner or Admin can list all leave requests.'
            ], 403);
        }

        $query = LeaveRequest::with('employee.user')
            ->orderBy('created_at', 'desc');

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        return response()->json([
            'success' => true,
            'data' => $query->get()
        ]);
    }

    /**
     * Approve a leave request.
     */
    public function approve(Request $request, $id)
    {
        $user = Auth::user();

        // Authorize: Only Admin or Owner can approve/reject leave requests
        if (!$user->hasRole('Owner') && !$user->hasRole('Admin')) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only Owner or Admin can approve leave requests.'
            ], 403);
        }

        $leaveRequest = LeaveRequest::with('employee')->find($id);

        if (!$leaveRequest) {
            return response()->json([
                'success' => false,
                'message' => 'Leave request not found.'
            ], 404);
        }

        if ($leaveRequest->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'This leave request has already been processed (current status: ' . $leaveRequest->status . ').'
            ], 422);
        }

        $employee = $leaveRequest->employee;
        $startDate = Carbon::parse($leaveRequest->start_date);
        $endDate = Carbon::parse($leaveRequest->end_date);
        $requestedDays = $leaveRequest->duration_days;

        // If it's annual leave, double check if balance is still sufficient
        if ($leaveRequest->type === 'annual_leave') {
            if ($requestedDays > $employee->leave_balance) {
                return response()->json([
                    'success' => false,
                    'message' => "Cannot approve. Employee's remaining leave balance ({$employee->leave_balance} days) is insufficient for this request ({$requestedDays} days)."
                ], 422);
            }

            // Deduct from employee leave balance
            $employee->decrement('leave_balance', $requestedDays);
        }

        // Update status to approved
        $leaveRequest->update([
            'status' => 'approved'
        ]);

        // If it's WFH, automatically generate attendance for workdays (excluding Sunday and Holidays)
        if ($leaveRequest->type === 'wfh') {
            $holidayDates = \App\Models\Holiday::pluck('date')
                ->map(fn($date) => Carbon::parse($date)->format('Y-m-d'))
                ->toArray();

            $curr = $startDate->copy();
            while ($curr->lte($endDate)) {
                $dateStr = $curr->format('Y-m-d');
                $isSunday = $curr->isSunday();
                $isHoliday = in_array($dateStr, $holidayDates);

                if (!$isSunday && !$isHoliday) {
                    \App\Models\Attendance::updateOrCreate(
                        [
                            'employee_id' => $employee->id,
                            'date' => $dateStr,
                        ],
                        [
                            'check_in' => '08:00:00',
                            'check_out' => '17:00:00',
                            'status' => 'wfh'
                        ]
                    );
                }
                $curr->addDay();
            }
        }

        // Send WhatsApp notification to the employee (Sender name: Omfai)
        if (!empty($employee->whatsapp_number)) {
            $typeLabel = str_replace('_', ' ', ucfirst($leaveRequest->type));
            $formattedStart = $startDate->format('d M Y');
            $formattedEnd = $endDate->format('d M Y');

            $waMessage = "*[Omfai - Status Pengajuan Cuti/Izin]*\n\n"
                . "Halo {$employee->name},\n"
                . "Pengajuan *{$typeLabel}* Anda telah disetujui.\n\n"
                . "Detail:\n"
                . "• Tanggal: {$formattedStart} s/d {$formattedEnd} ({$requestedDays} hari)\n"
                . "• Status: *APPROVED*\n\n"
                . "Salam Hangat,\n"
                . "*Omfai*";

            WhatsAppHelper::sendMessage($employee->whatsapp_number, $waMessage);
        }

        return response()->json([
            'success' => true,
            'message' => 'Leave request approved successfully.',
            'data' => $leaveRequest
        ]);
    }

    /**
     * Reject a leave request.
     */
    public function reject(Request $request, $id)
    {
        $user = Auth::user();

        // Authorize: Only Admin or Owner can approve/reject leave requests
        if (!$user->hasRole('Owner') && !$user->hasRole('Admin')) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only Owner or Admin can reject leave requests.'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'rejection_reason' => 'required|string|min:3',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Rejection reason is required and must be at least 3 characters.',
                'errors' => $validator->errors()
            ], 422);
        }

        $leaveRequest = LeaveRequest::with('employee')->find($id);

        if (!$leaveRequest) {
            return response()->json([
                'success' => false,
                'message' => 'Leave request not found.'
            ], 404);
        }

        if ($leaveRequest->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'This leave request has already been processed (current status: ' . $leaveRequest->status . ').'
            ], 422);
        }

        $employee = $leaveRequest->employee;
        $startDate = Carbon::parse($leaveRequest->start_date);
        $endDate = Carbon::parse($leaveRequest->end_date);
        $requestedDays = $leaveRequest->duration_days;

        // Update status to rejected
        $leaveRequest->update([
            'status' => 'rejected',
            'rejection_reason' => $request->rejection_reason,
        ]);

        // Send WhatsApp notification to the employee (Sender name: Omfai)
        if (!empty($employee->whatsapp_number)) {
            $typeLabel = str_replace('_', ' ', ucfirst($leaveRequest->type));
            $formattedStart = $startDate->format('d M Y');
            $formattedEnd = $endDate->format('d M Y');

            $waMessage = "*[Omfai - Status Pengajuan Cuti/Izin]*\n\n"
                . "Halo {$employee->name},\n"
                . "Pengajuan *{$typeLabel}* Anda telah ditolak.\n\n"
                . "Detail:\n"
                . "• Tanggal: {$formattedStart} s/d {$formattedEnd} ({$requestedDays} hari)\n"
                . "• Status: *REJECTED*\n"
                . "• Alasan Penolakan: {$request->rejection_reason}\n\n"
                . "Salam Hangat,\n"
                . "*Omfai*";

            WhatsAppHelper::sendMessage($employee->whatsapp_number, $waMessage);
        }

        return response()->json([
            'success' => true,
            'message' => 'Leave request rejected successfully.',
            'data' => $leaveRequest
        ]);
    }

    /**
     * Delete/cancel a leave request (Admin/Owner only).
     */
    public function destroy($id)
    {
        $user = Auth::user();

        // Only Admin or Owner can delete leave requests
        if (!$user->hasRole('Owner') && !$user->hasRole('Admin')) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only Owner or Admin can delete leave requests.'
            ], 403);
        }

        $leaveRequest = LeaveRequest::with('employee')->find($id);

        if (!$leaveRequest) {
            return response()->json([
                'success' => false,
                'message' => 'Leave request not found.'
            ], 404);
        }

        // If it is approved annual leave, refund the leave balance
        if ($leaveRequest->status === 'approved' && $leaveRequest->type === 'annual_leave') {
            $employee = $leaveRequest->employee;
            $startDate = Carbon::parse($leaveRequest->start_date);
            $endDate = Carbon::parse($leaveRequest->end_date);
            $requestedDays = $leaveRequest->duration_days;
            
            $employee->increment('leave_balance', $requestedDays);
        }

        // If it is approved WFH, delete the auto-generated WFH attendances
        if ($leaveRequest->status === 'approved' && $leaveRequest->type === 'wfh') {
            $startDate = Carbon::parse($leaveRequest->start_date)->format('Y-m-d');
            $endDate = Carbon::parse($leaveRequest->end_date)->format('Y-m-d');

            \App\Models\Attendance::where('employee_id', $leaveRequest->employee_id)
                ->whereBetween('date', [$startDate, $endDate])
                ->where('status', 'wfh')
                ->delete();
        }

        $leaveRequest->delete();

        return response()->json([
            'success' => true,
            'message' => 'Leave request deleted/cancelled successfully.'
        ]);
    }
}
