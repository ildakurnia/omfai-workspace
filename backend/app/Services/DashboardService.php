<?php

namespace App\Services;

use App\Enums\ActivityStatusEnum;
use App\Models\Activity;
use App\Models\Category;
use App\Models\User;
use App\Models\Employee;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardService
{
    /**
     * Menyusun data summary dashboard untuk Owner.
     * 
     * @return array
     */
    public function getDashboardSummary(): array
    {
        app(\App\Services\ActivityService::class)->autoPauseActivities();

        // 1. Hitung total karyawan (role Employee)
        $totalEmployees = User::role('Employee')->count();

        // 2. Hitung statistik aktivitas bulan berjalan
        $startOfMonth = Carbon::now('Asia/Jakarta')->startOfMonth();
        $endOfMonth = Carbon::now('Asia/Jakarta')->endOfMonth();

        $totalActivities = Activity::whereBetween('created_at', [$startOfMonth, $endOfMonth])->count();
        $inProgress = Activity::where('status', ActivityStatusEnum::IN_PROGRESS->value)->whereBetween('created_at', [$startOfMonth, $endOfMonth])->count();
        $onHold = Activity::where('status', ActivityStatusEnum::ON_HOLD->value)->whereBetween('created_at', [$startOfMonth, $endOfMonth])->count();
        $done = Activity::where('status', ActivityStatusEnum::DONE->value)->whereBetween('created_at', [$startOfMonth, $endOfMonth])->count();

        // 3. Aktivitas Terbaru (limit 10)
        $recentActivities = Activity::with(['user', 'category', 'logs'])
            ->latest('updated_at')
            ->limit(5)
            ->get()
            ->map(function ($activity) {
                return [
                    'id' => $activity['id'],
                    'employeeName' => $activity['user']['name'] ?? 'N/A',
                    'employeeAvatarUrl' => ($activity['user']['avatar'] ?? null) ? asset('storage/' . $activity['user']['avatar']) : null,
                    'categoryName' => $activity['category']['name'] ?? 'N/A',
                    'activity' => $activity['activity'],
                    'progressNote' => $activity['progress_note'],
                    'ownerFeedback' => $activity['owner_feedback'],
                    'feedbackAt' => $activity['feedback_at'] ? $activity['feedback_at']->toIso8601String() : null,
                    'status' => $activity['status']->value,
                    'holdReason' => $activity['hold_reason'],
                    'proofImageUrl' => $activity['proof_image_url'],
                    'createdAt' => $activity['created_at']->toIso8601String(),
                    'completedAt' => $activity['completed_at'] ? $activity['completed_at']->toIso8601String() : null,
                    'updatedAt' => $activity['updated_at']->toIso8601String(),
                    'logs' => $activity['logs']->map(function ($log) {
                        return [
                            'status' => $log['status']->value,
                            'createdAt' => $log['created_at']->toIso8601String(),
                        ];
                    })->toArray(),
                ];
            });

        // 4. Aktivitas yang sedang On Hold (menampilkan Kendala / Hold Reason)
        $onHoldActivities = Activity::with(['user', 'category'])
            ->where('status', ActivityStatusEnum::ON_HOLD->value)
            ->where('hold_reason', 'not like', 'Auto-pause%')
            ->where('hold_reason', 'not like', 'Auto-stop%')
            ->where('hold_reason', 'not like', 'Selesai Sesi Lembur%')
            ->where('hold_reason', 'not like', 'Transisi ke Lembur%')
            ->latest('updated_at')
            ->limit(5)
            ->get()
            ->map(function ($activity) {
                return [
                    'id' => $activity['id'],
                    'employeeName' => $activity['user']['name'] ?? 'N/A',
                    'employeeAvatarUrl' => ($activity['user']['avatar'] ?? null) ? asset('storage/' . $activity['user']['avatar']) : null,
                    'categoryName' => $activity['category']['name'] ?? 'N/A',
                    'activity' => $activity['activity'],
                    'status' => $activity['status']->value,
                    'holdReason' => $activity['hold_reason'],
                    'referenceLink' => $activity['reference_link'],
                    'proofImageUrl' => $activity['proof_image_url'],
                    'updatedAt' => $activity['updated_at']->toIso8601String(),
                ];
            });

        // 5. Agregasi Jumlah Aktivitas Berdasarkan Kategori
        $categorySummary = DB::table('activities')
            ->join('categories', 'activities.category_id', '=', 'categories.id')
            ->select('categories.name as categoryName', DB::raw('count(activities.id) as count'))
            ->groupBy('categories.name')
            ->get();

        // 6. Hitung statistik & detail kehadiran hari ini
        $today = Carbon::now('Asia/Jakarta')->toDateString();

        $employees = Employee::whereHas('user', function ($q) {
            $q->where('is_active', true);
        })->with([
            'user',
            'attendances' => function ($q) use ($today) {
                $q->where('date', $today);
            },
            'leaveRequests' => function ($q) use ($today) {
                $q->where('status', 'approved')
                  ->whereDate('start_date', '<=', $today)
                  ->whereDate('end_date', '>=', $today);
            },
            'workHourPermissions' => function ($q) use ($today) {
                $q->whereIn('status', ['approved', 'pending'])
                  ->whereDate('date', $today);
            }
        ])->get();

        $onTimeCount = 0;
        $lateCount = 0;
        $leaveCount = 0;
        $whPermissionCount = 0;
        $absentCount = 0;

        $todayAttendanceDetails = [];
        $earliestCheckIn = null;
        $earliestEmployeeId = null;

        foreach ($employees as $emp) {
            $attendance = $emp->attendances->first();
            $leave = $emp->leaveRequests->first();
            $whPermission = $emp->workHourPermissions->first();

            $status = 'absent';
            $statusLabel = 'Belum Absen';
            $checkIn = '-';
            $checkOut = '-';
            $lateMinutes = 0;
            $leaveType = null;
            $checkInRaw = null;

            $breakStart = '-';
            $breakEnd = '-';

            if ($attendance) {
                $checkIn = $attendance->check_in ? substr($attendance->check_in, 0, 5) : '-';
                $checkOut = $attendance->check_out ? substr($attendance->check_out, 0, 5) : '-';
                $breakStart = $attendance->break_start ? substr($attendance->break_start, 0, 5) : '-';
                $breakEnd = $attendance->break_end ? substr($attendance->break_end, 0, 5) : '-';
                $checkInRaw = $attendance->check_in;

                if ($attendance->status === 'late') {
                    // Hitung durasi keterlambatan dalam menit (dari jam 08:00:00)
                    if ($attendance->check_in) {
                        $checkInCarbon = Carbon::parse($today . ' ' . $attendance->check_in);
                        $shiftStartCarbon = Carbon::parse($today . ' 08:00:00');
                        $diff = (int) $shiftStartCarbon->diffInMinutes($checkInCarbon, false);
                        $lateMinutes = max(0, $diff);
                    }
                }
            }

            $workHourPermissionData = null;
            if ($whPermission) {
                $workHourPermissionData = [
                    'id' => $whPermission->id,
                    'type' => $whPermission->type,
                    'status' => $whPermission->status,
                    'start_time' => $whPermission->start_time ? substr($whPermission->start_time, 0, 5) : null,
                    'end_time' => $whPermission->end_time ? substr($whPermission->end_time, 0, 5) : null,
                    'actual_start_time' => $whPermission->actual_start_time ? substr($whPermission->actual_start_time, 0, 5) : null,
                    'actual_end_time' => $whPermission->actual_end_time ? substr($whPermission->actual_end_time, 0, 5) : null,
                ];

                if ($whPermission->status === 'approved') {
                    $status = 'wh_permission';
                    $whPermissionCount++;
                    if ($whPermission->type === 'arrive_late') {
                        $statusLabel = 'Izin Terlambat';
                    } else if ($whPermission->type === 'leave_early') {
                        $statusLabel = 'Izin Pulang Cepat';
                    } else {
                        $statusLabel = 'Izin Keluar Sementara';
                    }
                }
            }

            if ($status !== 'wh_permission') {
                if ($attendance) {
                    if ($attendance->status === 'present') {
                        $status = 'present';
                        $statusLabel = 'Hadir Tepat Waktu';
                        $onTimeCount++;

                        // Lacak check-in tercepat (Early Bird) yang on-time
                        if ($attendance->check_in) {
                            if (is_null($earliestCheckIn) || $attendance->check_in < $earliestCheckIn) {
                                $earliestCheckIn = $attendance->check_in;
                                $earliestEmployeeId = $emp->id;
                            }
                        }
                    } else if ($attendance->status === 'late') {
                        $status = 'late';
                        $statusLabel = 'Terlambat';
                        $lateCount++;
                    } else if ($attendance->status === 'wfh') {
                        $status = 'wfh';
                        $statusLabel = 'WFH';
                        $onTimeCount++;
                    }
                } else if ($leave) {
                    $status = 'leave';
                    $leaveCount++;
                    if ($leave->type === 'annual_leave') {
                        $statusLabel = 'Cuti Tahunan';
                        $leaveType = 'Cuti Tahunan';
                    } else if ($leave->type === 'sick_leave') {
                        $statusLabel = 'Sakit';
                        $leaveType = 'Sakit';
                    } else {
                        $statusLabel = 'Izin Umum';
                        $leaveType = 'Izin Umum';
                    }
                } else {
                    $absentCount++;
                }
            }

            $todayAttendanceDetails[] = [
                'employee_id' => $emp->id,
                'employee_code' => $emp->employee_code,
                'name' => $emp->name,
                'avatar_url' => ($emp->user->avatar ?? null) ? asset('storage/' . $emp->user->avatar) : null,
                'status' => $status,
                'status_label' => $statusLabel,
                'check_in' => $checkIn,
                'check_out' => $checkOut,
                'break_start' => $breakStart,
                'break_end' => $breakEnd,
                'check_in_raw' => $checkInRaw,
                'late_minutes' => $lateMinutes,
                'leave_type' => $leaveType,
                'is_earliest' => false,
                'work_hour_permission' => $workHourPermissionData,
            ];
        }

        // Set is_earliest untuk karyawan dengan check-in tercepat yang on-time
        if (!is_null($earliestEmployeeId)) {
            foreach ($todayAttendanceDetails as &$detail) {
                if ($detail['employee_id'] === $earliestEmployeeId) {
                    $detail['is_earliest'] = true;
                }
            }
        }

        // Sort: is_earliest -> present/late (by check_in_raw asc) -> leave -> absent
        usort($todayAttendanceDetails, function ($a, $b) {
            if ($a['is_earliest'] && !$b['is_earliest']) return -1;
            if (!$a['is_earliest'] && $b['is_earliest']) return 1;

            $aIsPresent = in_array($a['status'], ['present', 'late', 'wfh']);
            $bIsPresent = in_array($b['status'], ['present', 'late', 'wfh']);

            if ($aIsPresent && !$bIsPresent) return -1;
            if (!$aIsPresent && $bIsPresent) return 1;

            if ($aIsPresent && $bIsPresent) {
                return strcmp($a['check_in_raw'], $b['check_in_raw']);
            }

            $aIsLeave = $a['status'] === 'leave';
            $bIsLeave = $b['status'] === 'leave';

            if ($aIsLeave && !$bIsLeave) return -1;
            if (!$aIsLeave && $bIsLeave) return 1;

            return strcmp($a['name'], $b['name']);
        });

        // 7. Hitung total lembur bulanan
        $holidayDates = \App\Models\Holiday::pluck('date')->toArray();

        $monthActivities = Activity::with(['logs', 'user'])
            ->whereBetween('created_at', [$startOfMonth, $endOfMonth])
            ->get();

        $totalOvertimeMinutes = 0;
        $employeeOvertime = []; // user_id => ['user_id' => ..., 'name' => ..., 'overtime_minutes' => 0]

        foreach ($monthActivities as $activity) {
            $minutes = $this->calculateOvertimeMinutes($activity, $holidayDates);
            if ($minutes > 0) {
                $totalOvertimeMinutes += $minutes;
                
                $userId = $activity->user_id;
                $userName = $activity->user->name ?? 'N/A';
                
                if (!isset($employeeOvertime[$userId])) {
                    $employeeOvertime[$userId] = [
                        'user_id' => $userId,
                        'name' => $userName,
                        'overtime_minutes' => 0,
                    ];
                }
                $employeeOvertime[$userId]['overtime_minutes'] += $minutes;
            }
        }

        $employeeOvertimeList = array_values($employeeOvertime);
        usort($employeeOvertimeList, function ($a, $b) {
            return $b['overtime_minutes'] <=> $a['overtime_minutes'];
        });

        $totalHours = floor($totalOvertimeMinutes / 60);
        $totalMins = $totalOvertimeMinutes % 60;
        $totalOvertimeFormatted = $totalHours > 0 ? "{$totalHours} jam {$totalMins} menit" : "{$totalMins} menit";

        return [
            'totalEmployees' => $totalEmployees,
            'totalActivities' => $totalActivities,
            'inProgress' => $inProgress,
            'onHold' => $onHold,
            'done' => $done,
            'recentActivities' => $recentActivities,
            'onHoldActivities' => $onHoldActivities,
            'categorySummary' => $categorySummary,
            'attendanceSummary' => [
                'onTimeCount' => $onTimeCount,
                'lateCount' => $lateCount,
                'leaveCount' => $leaveCount,
                'whPermissionCount' => $whPermissionCount,
                'absentCount' => $absentCount,
                'details' => $todayAttendanceDetails,
            ],
            'overtimeSummary' => [
                'total_minutes' => $totalOvertimeMinutes,
                'total_formatted' => $totalOvertimeFormatted,
                'details' => $employeeOvertimeList,
            ],
        ];
    }

    public function calculateWorkingMinutes(Carbon $startDate, Carbon $endDate, array $holidayDates): int
    {
        if ($endDate->lte($startDate)) {
            return 0;
        }

        $totalMinutes = 0;
        $current = $startDate->copy();

        while (true) {
            $dayOfWeek = $current->dayOfWeek; // 0: Sunday, 1: Monday, ..., 6: Saturday
            $dateStr = $current->toDateString();

            // Skip Sunday and holidays
            if ($dayOfWeek !== 0 && !in_array($dateStr, $holidayDates)) {
                $isSaturday = $dayOfWeek === 6;
                $workStartHour = 8;
                $workEndHour = $isSaturday ? 12 : 17;

                $workStart = $current->copy()->setTime($workStartHour, 0, 0);
                $workEnd = $current->copy()->setTime($workEndHour, 0, 0);

                // Task start today
                $taskStart = $current->copy();
                if ($taskStart->lt($workStart)) {
                    $taskStart = $workStart;
                }

                // Task end today
                $taskEnd = $current->copy()->setTime(23, 59, 59);
                if ($current->toDateString() === $endDate->toDateString()) {
                    $taskEnd = $endDate->copy();
                }
                if ($taskEnd->gt($workEnd)) {
                    $taskEnd = $workEnd;
                }

                if ($taskStart->lt($taskEnd)) {
                    $totalMinutes += $taskStart->diffInMinutes($taskEnd);
                }
            }

            if ($current->toDateString() === $endDate->toDateString()) {
                break;
            }

            $current->addDay()->setTime(0, 0, 0);
        }

        return $totalMinutes;
    }

    public function calculateOvertimeMinutes($activity, array $holidayDates): int
    {
        $holdReason = $activity->hold_reason;
        $isOvertimeTask = $holdReason && (
            $holdReason === 'Lembur' ||
            str_contains($holdReason, 'Lembur') ||
            str_contains($holdReason, 'Overtime')
        );

        if (!$isOvertimeTask) {
            return 0;
        }

        $createdAtStr = $activity->created_at->toIso8601String();
        $completedAtStr = $activity->completed_at ? $activity->completed_at->toIso8601String() : null;

        $isLogStartOutside = function (Carbon $logTime) use ($holidayDates) {
            $logDay = $logTime->dayOfWeek;
            $logHour = $logTime->hour;
            $logDateStr = $logTime->toDateString();

            if ($logDay === 0) return true;
            if (in_array($logDateStr, $holidayDates)) return true;
            if ($logDay === 6) return $logHour < 8 || $logHour >= 12;
            return $logHour < 8 || $logHour >= 17;
        };

        $logs = $activity->logs;

        if ($logs->isEmpty()) {
            $start = Carbon::parse($createdAtStr);
            if (!$isLogStartOutside($start)) return 0;

            $end = $completedAtStr ? Carbon::parse($completedAtStr) : Carbon::now('Asia/Jakarta');
            $total = $start->diffInMinutes($end);
            $standard = $this->calculateWorkingMinutes($start, $end, $holidayDates);
            $overtime = $total - $standard;
            return $overtime > 0 ? $overtime : 0;
        }

        // Sort logs ascending
        $sortedLogs = $logs->sortBy(function ($log) {
            return Carbon::parse($log->created_at)->timestamp;
        })->values();

        $totalOvertimeMinutes = 0;

        // Skip index 0 log
        for ($i = 1; $i < count($sortedLogs); $i++) {
            $log = $sortedLogs[$i];
            $logStatus = $log->status->value ?? $log->status;
            $startTime = Carbon::parse($log->created_at);

            if (!$isLogStartOutside($startTime)) continue;

            if ($i < count($sortedLogs) - 1) {
                $nextLog = $sortedLogs[$i + 1];
                $endTime = Carbon::parse($nextLog->created_at);
            } else {
                if ($logStatus === 'done') {
                    $endTime = $completedAtStr ? Carbon::parse($completedAtStr) : $startTime->copy();
                } else if ($logStatus === 'on_hold') {
                    $endTime = $startTime->copy();
                } else {
                    $endTime = Carbon::now('Asia/Jakarta');
                }
            }

            if ($logStatus === 'in_progress' && $endTime->gt($startTime)) {
                $totalInterval = $startTime->diffInMinutes($endTime);
                $standardInterval = $this->calculateWorkingMinutes($startTime, $endTime, $holidayDates);
                $overtimeInterval = $totalInterval - $standardInterval;

                if ($overtimeInterval > 0) {
                    $totalOvertimeMinutes += $overtimeInterval;
                }
            }
        }

        return $totalOvertimeMinutes;
    }
}
