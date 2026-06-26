<?php

namespace App\Services;

use App\Enums\ActivityStatusEnum;
use App\Models\Activity;
use App\Models\ActivityLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ActivityService
{
    /**
     * Deteksi & pause otomatis untuk aktivitas in_progress yang melampaui batas operasional / lembur.
     */
    public function autoPauseActivities(): void
    {
        $holidayDates = \App\Models\Holiday::pluck('date')->toArray();
        $now = Carbon::now('Asia/Jakarta');

        // Cleanup: Kembalikan tugas yang sebelumnya di-pause otomatis oleh sistem ke in_progress
        $autoPausedActivities = Activity::where('status', ActivityStatusEnum::ON_HOLD->value)
            ->where('hold_reason', 'Auto-pause jam pulang kantor')
            ->get();

        foreach ($autoPausedActivities as $activity) {
            DB::transaction(function () use ($activity) {
                DB::table('activities')->where('id', $activity->id)->update([
                    'status' => ActivityStatusEnum::IN_PROGRESS->value,
                    'hold_reason' => null,
                ]);

                // Hapus log on_hold terakhir untuk mengaktifkan kembali log in_progress sebelumnya
                $lastOnHoldLog = DB::table('activity_logs')
                    ->where('activity_id', $activity->id)
                    ->where('status', ActivityStatusEnum::ON_HOLD->value)
                    ->orderBy('id', 'desc')
                    ->first();

                if ($lastOnHoldLog) {
                    DB::table('activity_logs')->where('id', $lastOnHoldLog->id)->delete();
                }
            });
        }


    }

    private function isOutsideOperationalHours(Carbon $time, array $holidayDates): bool
    {
        $dayOfWeek = $time->dayOfWeek;
        $dateStr = $time->toDateString();

        if ($dayOfWeek === 0) { // Minggu
            return true;
        }
        if (in_array($dateStr, $holidayDates)) {
            return true;
        }

        $hour = $time->hour;
        if ($dayOfWeek === 6) { // Sabtu
            return $hour >= 12;
        }

        return $hour >= 17;
    }

    /**
     * Mengambil daftar aktivitas berdasarkan role dan filter yang diberikan.
     * 
     * @param User $user User yang mengakses
     * @param array $filters Filter pencarian (periode, karyawan/user_id, kategori, status)
     * @return LengthAwarePaginator
     */
    public function getActivities(User $user, array $filters): LengthAwarePaginator
    {
        $this->autoPauseActivities();

        $query = Activity::with(['user', 'category', 'logs.changedByUser'])
            ->latest('updated_at');

        // BR-06: Karyawan biasa hanya melihat aktivitas milik sendiri
        if ($user->hasRole('Employee')) {
            $query->where('user_id', $user['id']);
        } else {
            // Admin & Owner bisa memfilter berdasarkan Karyawan
            if (!empty($filters['user_id'])) {
                $query->where('user_id', $filters['user_id']);
            }
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

        return $query->paginate($filters['per_page'] ?? 15);
    }

    /**
     * Membuat aktivitas baru.
     * 
     * @param User $user Pembuat aktivitas
     * @param array $data Data input
     * @return Activity
     */
    public function createActivity(User $user, array $data): Activity
    {
        return DB::transaction(function () use ($user, $data) {
            $status = $data['status'];
            $completedAt = ($status === ActivityStatusEnum::DONE->value) ? Carbon::now() : null;

            // 1. Simpan aktivitas
            $activity = Activity::create([
                'user_id' => $user['id'],
                'category_id' => $data['category_id'],
                'activity' => $data['activity'],
                'status' => $status,
                'hold_reason' => $status === ActivityStatusEnum::ON_HOLD->value ? $data['hold_reason'] : ($data['hold_reason'] ?? null),
                'reference_link' => $data['reference_link'] ?? null,
                'progress_note' => $data['progress_note'] ?? null,
                'completed_at' => $completedAt,
            ]);

            // 2. Catat log perubahan status pertama kali (Audit Trail Sederhana)
            ActivityLog::create([
                'activity_id' => $activity['id'],
                'status' => $status,
                'changed_by' => $user['id'],
            ]);

            return $activity->load(['category', 'user']);
        });
    }

    /**
     * Memperbarui aktivitas berdasarkan aturan bisnis (BR-06, BR-12, BR-14, BR-15, BR-16).
     * 
     * @param User $updater User yang memperbarui data
     * @param Activity $activity Objek aktivitas yang akan diupdate
     * @param array $data Data baru
     * @return Activity
     * @throws ValidationException
     */
    public function updateActivity(User $updater, Activity $activity, array $data): Activity
    {
        // Pengecekan Hak Akses Update (BR-06 & BR-16)
        $isEmployee = $updater->hasRole('Employee');
        $isAdmin = $updater->hasRole('Admin');

        if ($isEmployee && $activity['user_id'] !== $updater['id']) {
            throw ValidationException::withMessages([
                'activity' => ['Anda hanya diperbolehkan mengubah aktivitas milik Anda sendiri.'], // BR-06
            ]);
        }

        // Pengecekan apakah statusnya sudah Done (BR-15)
        if ($isEmployee && $activity['status'] === ActivityStatusEnum::DONE) {
            throw ValidationException::withMessages([
                'activity' => ['Aktivitas yang sudah berstatus Done tidak dapat diubah kembali.'], // BR-15
            ]);
        }

        return DB::transaction(function () use ($updater, $activity, $data, $isAdmin) {
            $oldStatus = $activity['status']->value;
            $newStatus = $data['status'];

            $updateFields = [
                'category_id' => $data['category_id'],
                'activity' => $data['activity'],
                'status' => $newStatus,
                'reference_link' => $data['reference_link'] ?? null,
                'progress_note' => $data['progress_note'] ?? null,
            ];

            // Aturan Hold Reason (BR-04 & BR-05)
            if ($newStatus === ActivityStatusEnum::ON_HOLD->value) {
                $updateFields['hold_reason'] = $data['hold_reason'];
            } else {
                // Opsional, tapi disarankan dikosongkan jika sudah kembali in_progress atau done
                $updateFields['hold_reason'] = $data['hold_reason'] ?? null;
            }

            // Aturan Completed At (BR-14)
            if ($newStatus === ActivityStatusEnum::DONE->value && $oldStatus !== ActivityStatusEnum::DONE->value) {
                $updateFields['completed_at'] = Carbon::now();
            } elseif ($newStatus !== ActivityStatusEnum::DONE->value) {
                $updateFields['completed_at'] = null;
            }

            // Update Aktivitas
            $activity->update($updateFields);

            // Jika status berubah, catat ke log (Audit Trail Sederhana)
            if ($newStatus !== $oldStatus) {
                ActivityLog::create([
                    'activity_id' => $activity['id'],
                    'status' => $newStatus,
                    'changed_by' => $updater['id'],
                ]);
            }

            return $activity->load(['category', 'user', 'logs.changedByUser']);
        });
    }

    /**
     * Koreksi/hapus aktivitas jika diperlukan (Admin only / Owner-own jika belum done).
     * 
     * @param User $updater
     * @param Activity $activity
     * @return bool|null
     * @throws ValidationException
     */
    public function deleteActivity(User $updater, Activity $activity): ?bool
    {
        $isEmployee = $updater->hasRole('Employee');

        if ($isEmployee && $activity['user_id'] !== $updater['id']) {
            throw ValidationException::withMessages([
                'activity' => ['Anda hanya diperbolehkan menghapus aktivitas milik Anda sendiri.'],
            ]);
        }

        if ($isEmployee && $activity['status'] === ActivityStatusEnum::DONE) {
            throw ValidationException::withMessages([
                'activity' => ['Aktivitas yang sudah berstatus Done tidak dapat dihapus.'],
            ]);
        }

        return $activity->delete();
    }

    /**
     * Menambahkan atau memperbarui review/feedback dari Owner.
     * 
     * @param Activity $activity
     * @param string|null $feedback
     * @return Activity
     */
    public function addActivityReview(Activity $activity, ?string $feedback): Activity
    {
        $activity->update([
            'owner_feedback' => $feedback,
            'feedback_at' => $feedback ? Carbon::now() : null,
        ]);

        return $activity->load(['category', 'user', 'logs.changedByUser']);
    }
}
