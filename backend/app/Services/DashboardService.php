<?php

namespace App\Services;

use App\Enums\ActivityStatusEnum;
use App\Models\Activity;
use App\Models\Category;
use App\Models\User;
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
        // 1. Hitung total karyawan (role Employee)
        $totalEmployees = User::role('Employee')->count();

        // 2. Hitung statistik aktivitas
        $totalActivities = Activity::count();
        $inProgress = Activity::where('status', ActivityStatusEnum::IN_PROGRESS->value)->count();
        $onHold = Activity::where('status', ActivityStatusEnum::ON_HOLD->value)->count();
        $done = Activity::where('status', ActivityStatusEnum::DONE->value)->count();

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
        $onHoldActivities = Activity::with('user')
            ->where('status', ActivityStatusEnum::ON_HOLD->value)
            ->latest('updated_at')
            ->limit(5)
            ->get()
            ->map(function ($activity) {
                return [
                    'id' => $activity['id'],
                    'employeeName' => $activity['user']['name'] ?? 'N/A',
                    'employeeAvatarUrl' => ($activity['user']['avatar'] ?? null) ? asset('storage/' . $activity['user']['avatar']) : null,
                    'activity' => $activity['activity'],
                    'holdReason' => $activity['hold_reason'],
                    'updatedAt' => $activity['updated_at']->toIso8601String(),
                ];
            });

        // 5. Agregasi Jumlah Aktivitas Berdasarkan Kategori
        $categorySummary = DB::table('activities')
            ->join('categories', 'activities.category_id', '=', 'categories.id')
            ->select('categories.name as categoryName', DB::raw('count(activities.id) as count'))
            ->groupBy('categories.name')
            ->get();

        return [
            'totalEmployees' => $totalEmployees,
            'totalActivities' => $totalActivities,
            'inProgress' => $inProgress,
            'onHold' => $onHold,
            'done' => $done,
            'recentActivities' => $recentActivities,
            'onHoldActivities' => $onHoldActivities,
            'categorySummary' => $categorySummary,
        ];
    }
}
