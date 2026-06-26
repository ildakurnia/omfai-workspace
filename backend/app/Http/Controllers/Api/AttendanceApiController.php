<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Geofence;
use App\Models\Holiday;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class AttendanceApiController extends Controller
{
    /**
     * Check-in or Check-out for the employee.
     */
    public function tap(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Coordinates are required.',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = Auth::user();
        $employee = $user->employee;

        if (!$employee) {
            return response()->json([
                'success' => false,
                'message' => 'Employee profile not found for this user.'
            ], 404);
        }

        $now = Carbon::now();
        $today = $now->toDateString();
        $currentTime = $now->toTimeString();
        $dayOfWeek = $now->dayOfWeek; // 0 (Sunday) to 6 (Saturday)

        // 1. Sunday check
        if ($dayOfWeek === Carbon::SUNDAY) {
            return response()->json([
                'success' => false,
                'message' => 'Attendance rejected. Sunday is a rest day.'
            ], 403);
        }

        // 2. Dynamic holiday check
        $isHoliday = Holiday::whereDate('date', $today)->exists();
        if ($isHoliday) {
            return response()->json([
                'success' => false,
                'message' => 'Attendance rejected. Today is a public holiday.'
            ], 403);
        }

        // 3. Approved leave check for today
        $isOnLeave = \App\Models\LeaveRequest::where('employee_id', $employee->id)
            ->where('status', 'approved')
            ->whereDate('start_date', '<=', $today)
            ->whereDate('end_date', '>=', $today)
            ->exists();

        if ($isOnLeave) {
            return response()->json([
                'success' => false,
                'message' => 'Attendance rejected. You are on approved leave today.'
            ], 403);
        }

        // 4. Geofencing check
        $geofences = Geofence::all();
        if ($geofences->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'No geofencing coordinates are configured on the server.'
            ], 400);
        }

        $inRange = false;
        $userLat = $request->latitude;
        $userLng = $request->longitude;

        foreach ($geofences as $geofence) {
            $distance = $this->calculateDistance($userLat, $userLng, $geofence->latitude, $geofence->longitude);
            if ($distance <= $geofence->radius) {
                $inRange = true;
                break;
            }
        }

        if (!$inRange) {
            return response()->json([
                'success' => false,
                'message' => 'You are outside the allowed geofence area.'
            ], 403);
        }

        // Determine shift rules based on day of week
        // Mon-Fri: 08:00 - 17:00
        // Sat: 08:00 - 12:00
        $shiftStart = '08:00:00';
        $shiftEnd = ($dayOfWeek === Carbon::SATURDAY) ? '12:00:00' : '17:00:00';

        // Check if attendance record already exists for today
        $attendance = Attendance::where('employee_id', $employee->id)
            ->whereDate('date', $today)
            ->first();

        if (!$attendance) {
            // TAP MASUK (Check-In)
            // Tap check-in is opened starting from 06:00 AM
            if ($currentTime < '06:00:00') {
                return response()->json([
                    'success' => false,
                    'message' => 'Check-in is only allowed after 06:00 AM.'
                ], 403);
            }

            // Determine check-in status: late if after 08:00
            $status = ($currentTime > $shiftStart) ? 'late' : 'present';

            $attendance = Attendance::create([
                'employee_id' => $employee->id,
                'date' => $today,
                'check_in' => $currentTime,
                'status' => $status,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Successfully checked in. Status: ' . ucfirst($status),
                'data' => $attendance
            ]);
        } else {
            // TAP PULANG (Check-Out)
            if ($attendance->check_out) {
                return response()->json([
                    'success' => false,
                    'message' => 'You have already checked out today.'
                ], 403);
            }

            // Check-out is locked until the end of shift
            if ($currentTime < $shiftEnd) {
                return response()->json([
                    'success' => false,
                    'message' => 'Check-out is locked until ' . substr($shiftEnd, 0, 5) . '.'
                ], 403);
            }

            $attendance->update([
                'check_out' => $currentTime,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Successfully checked out.',
                'data' => $attendance
            ]);
        }
    }

    /**
     * Get attendance history for the authenticated employee.
     */
    public function history(Request $request)
    {
        $user = Auth::user();
        $employee = $user->employee;

        if (!$employee) {
            return response()->json([
                'success' => false,
                'message' => 'Employee profile not found.'
            ], 404);
        }

        $history = Attendance::where('employee_id', $employee->id)
            ->orderBy('date', 'desc')
            ->get();

        // Calculate statistics
        $totalPresent = $history->where('status', 'present')->count();
        $totalLate = $history->where('status', 'late')->count();

        return response()->json([
            'success' => true,
            'data' => $history,
            'summary' => [
                'total_present' => $totalPresent,
                'total_late' => $totalLate,
                'total_attendance' => $history->count(),
            ]
        ]);
    }

    /**
     * Get all active geofencing boundaries.
     */
    public function geofences()
    {
        $geofences = Geofence::all();
        return response()->json([
            'success' => true,
            'data' => $geofences
        ]);
    }

    /**
     * Helper: Haversine distance formula (in meters).
     */
    private function calculateDistance($lat1, $lon1, $lat2, $lon2)
    {
        $earthRadius = 6371000; // Earth radius in meters

        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);

        $a = sin($dLat / 2) * sin($dLat / 2) +
            cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
            sin($dLon / 2) * sin($dLon / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadius * $c;
    }

    /**
     * Delete an attendance record (Admin only).
     */
    public function destroy($id)
    {
        $user = Auth::user();
        if (!$user->hasRole('Admin')) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only Admin can delete attendance records.'
            ], 403);
        }

        $attendance = Attendance::find($id);
        if (!$attendance) {
            return response()->json([
                'success' => false,
                'message' => 'Attendance record not found.'
            ], 404);
        }

        $attendance->delete();

        return response()->json([
            'success' => true,
            'message' => 'Attendance record deleted successfully.'
        ]);
    }
}
