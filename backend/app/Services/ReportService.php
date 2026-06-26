<?php

namespace App\Services;

use App\Models\Activity;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;

class ReportService
{
    /**
     * Memfilter data aktivitas untuk kebutuhan pelaporan.
     * 
     * @param array $filters
     * @return Collection
     */
    public function getReportData(array $filters): Collection
    {
        app(\App\Services\ActivityService::class)->autoPauseActivities();

        $query = Activity::with(['user', 'category', 'logs'])->latest('created_at');

        // Filter Karyawan
        if (!empty($filters['user_id'])) {
            $query->where('user_id', $filters['user_id']);
        }

        // Filter Kategori
        if (!empty($filters['category_id'])) {
            $query->where('category_id', $filters['category_id']);
        }

        // Filter Status
        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        // Filter Periode (Date Range)
        if (!empty($filters['start_date']) && !empty($filters['end_date'])) {
            $startDate = Carbon::parse($filters['start_date'])->startOfDay();
            $endDate = Carbon::parse($filters['end_date'])->endOfDay();
            $query->whereBetween('created_at', [$startDate, $endDate]);
        }

        $activities = $query->get();

        // Filter overtime only
        if (!empty($filters['overtime_only']) && ($filters['overtime_only'] === 'true' || $filters['overtime_only'] === true || $filters['overtime_only'] === '1')) {
            $holidayDates = \App\Models\Holiday::pluck('date')->toArray();
            $activities = $activities->filter(function ($activity) use ($holidayDates) {
                return $this->calculateOvertimeMinutes($activity, $holidayDates) > 0;
            })->values();
        }

        return $activities;
    }

    /**
     * Merender data aktivitas ke dalam format dokumen PDF menggunakan DomPDF.
     * 
     * @param array $filters
     * @return \Barryvdh\DomPDF\PDF
     */
    public function generatePdf(array $filters): \Barryvdh\DomPDF\PDF
    {
        $activities = $this->getReportData($filters);
        $holidayDates = \App\Models\Holiday::pluck('date')->toArray();

        $totalOvertimeSum = 0;
        foreach ($activities as $activity) {
            $overtimeMinutes = $this->calculateOvertimeMinutes($activity, $holidayDates);
            $activity->overtime_minutes = $overtimeMinutes;
            
            if ($overtimeMinutes > 0) {
                $hours = floor($overtimeMinutes / 60);
                $minutes = $overtimeMinutes % 60;
                $activity->overtime_duration_formatted = $hours > 0 ? "{$hours} jam {$minutes} menit" : "{$minutes} menit";
                $totalOvertimeSum += $overtimeMinutes;
            } else {
                $activity->overtime_duration_formatted = '';
            }
        }

        $totalHours = floor($totalOvertimeSum / 60);
        $totalMins = $totalOvertimeSum % 60;
        $totalOvertimeFormatted = $totalOvertimeSum > 0 ? "{$totalHours} jam {$totalMins} menit" : "0 menit";
        
        $startDate = !empty($filters['start_date']) ? Carbon::parse($filters['start_date'])->format('d M Y') : 'Awal';
        $endDate = !empty($filters['end_date']) ? Carbon::parse($filters['end_date'])->format('d M Y') : 'Sekarang';
        
        $period = $startDate . ' - ' . $endDate;

        // Load view blade pdf.report dan ubah ke PDF
        $pdf = Pdf::loadView('pdf.report', [
            'activities' => $activities,
            'period' => $period,
            'filters' => $filters,
            'is_overtime_only' => !empty($filters['overtime_only']) && ($filters['overtime_only'] === 'true' || $filters['overtime_only'] === true || $filters['overtime_only'] === '1'),
            'total_overtime_formatted' => $totalOvertimeFormatted,
        ]);

        // Opsional: Atur ukuran kertas ke A4 Portrait
        $pdf->setPaper('a4', 'portrait');

        return $pdf;
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
