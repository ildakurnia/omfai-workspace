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

            // Determine check-in status: late if starting from 08:01:00
            $status = ($currentTime >= '08:01:00') ? 'late' : 'present';

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

            // Check-out is locked until the end of shift, unless employee has an approved 'leave_early' permission
            $hasLeaveEarlyPermission = \App\Models\WorkHourPermission::where('employee_id', $employee->id)
                ->where('date', $today)
                ->where('type', 'leave_early')
                ->where('status', 'approved')
                ->exists();

            if ($currentTime < $shiftEnd && !$hasLeaveEarlyPermission) {
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

        // Get earliest check-in time for each date in history
        $dates = $history->pluck('date')->map(function($d) {
            return $d instanceof \Carbon\Carbon ? $d->toDateString() : $d;
        })->unique()->toArray();

        $earliestCheckIns = Attendance::whereIn('date', $dates)
            ->whereNotNull('check_in')
            ->whereIn('status', ['present', 'late'])
            ->select('date', \DB::raw('MIN(check_in) as min_check_in'))
            ->groupBy('date')
            ->get()
            ->mapWithKeys(function ($item) {
                $dateStr = $item->date instanceof \Carbon\Carbon ? $item->date->toDateString() : (string)$item->date;
                return [$dateStr => $item->min_check_in];
            })
            ->toArray();

        $historyData = $history->map(function ($attendance) use ($earliestCheckIns) {
            $dateStr = $attendance->date instanceof \Carbon\Carbon ? $attendance->date->toDateString() : (string)$attendance->date;
            $minCheckIn = $earliestCheckIns[$dateStr] ?? null;
            
            $isEarliest = false;
            if ($attendance->check_in && $minCheckIn && $attendance->check_in === $minCheckIn) {
                $isEarliest = true;
            }

            $arr = $attendance->toArray();
            $arr['is_earliest'] = $isEarliest;
            return $arr;
        });

        // Calculate statistics
        $totalPresent = $history->where('status', 'present')->count();
        $totalLate = $history->where('status', 'late')->count();

        return response()->json([
            'success' => true,
            'data' => $historyData,
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
     * Record start or end break time for today.
     */
    public function istirahat(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Koordinat lokasi diperlukan.',
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

        $now = Carbon::now();
        $today = $now->toDateString();
        $currentTime = $now->toTimeString();

        // Check if attendance record exists for today
        $attendance = Attendance::where('employee_id', $employee->id)
            ->whereDate('date', $today)
            ->first();

        if (!$attendance) {
            return response()->json([
                'success' => false,
                'message' => 'Anda harus melakukan Absen Masuk terlebih dahulu.'
            ], 403);
        }

        if ($attendance->check_out) {
            return response()->json([
                'success' => false,
                'message' => 'Anda sudah melakukan Absen Pulang hari ini.'
            ], 403);
        }

        // Limit break_start to be clicked only after 12:00
        if (!$attendance->break_start && $currentTime < '12:00:00') {
            return response()->json([
                'success' => false,
                'message' => 'Istirahat hanya diperbolehkan setelah jam 12:00 siang.'
            ], 403);
        }

        // Geofencing check
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
                'message' => 'Anda berada di luar area geofence yang diizinkan.'
            ], 403);
        }

        if (!$attendance->break_start) {
            // Start break
            $attendance->update([
                'break_start' => $currentTime
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Selamat beristirahat.',
                'data' => $attendance
            ]);
        } elseif (!$attendance->break_end) {
            // End break
            $attendance->update([
                'break_end' => $currentTime
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Selamat kembali bekerja.',
                'data' => $attendance
            ]);
        } else {
            return response()->json([
                'success' => false,
                'message' => 'Anda sudah menyelesaikan istirahat hari ini.'
            ], 403);
        }
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
