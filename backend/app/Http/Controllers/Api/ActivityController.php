<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreActivityRequest;
use App\Http\Requests\UpdateActivityRequest;
use App\Models\Activity;
use App\Services\ActivityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ActivityController extends Controller
{
    protected ActivityService $activityService;

    /**
     * Inject ActivityService.
     */
    public function __construct(ActivityService $activityService)
    {
        $this->activityService = $activityService;
    }

    /**
     * Tampilkan list aktivitas dengan filter & paginasi.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['start_date', 'end_date', 'category_id', 'status', 'user_id', 'per_page']);
        $activities = $this->activityService->getActivities($request->user(), $filters);

        return response()->json([
            'message' => 'Daftar aktivitas berhasil dimuat.',
            'data' => $activities,
        ]);
    }

    /**
     * Buat aktivitas baru.
     */
    public function store(StoreActivityRequest $request): JsonResponse
    {
        $activity = $this->activityService->createActivity($request->user(), $request->validated());

        return response()->json([
            'message' => 'Aktivitas berhasil dicatat.',
            'data' => $activity,
        ], 201);
    }

    /**
     * Detail aktivitas.
     */
    public function show(Request $request, Activity $activity): JsonResponse
    {
        $user = $request->user();

        // Karyawan biasa hanya boleh melihat detail miliknya sendiri
        if ($user->hasRole('Employee') && $activity['user_id'] !== $user['id']) {
            throw ValidationException::withMessages([
                'activity' => ['Anda tidak memiliki akses untuk melihat aktivitas ini.'],
            ]);
        }

        return response()->json([
            'message' => 'Detail aktivitas berhasil dimuat.',
            'data' => $activity->load(['category', 'user', 'logs.changedByUser']),
        ]);
    }

    /**
     * Ubah aktivitas.
     */
    public function update(UpdateActivityRequest $request, Activity $activity): JsonResponse
    {
        $updatedActivity = $this->activityService->updateActivity(
            $request->user(),
            $activity,
            $request->validated()
        );

        return response()->json([
            'message' => 'Aktivitas berhasil diperbarui.',
            'data' => $updatedActivity,
        ]);
    }

    /**
     * Hapus aktivitas.
     */
    public function destroy(Request $request, Activity $activity): JsonResponse
    {
        $this->activityService->deleteActivity($request->user(), $activity);

        return response()->json([
            'message' => 'Aktivitas berhasil dihapus.',
        ]);
    }

    /**
     * Berikan feedback/catatan Owner pada aktivitas.
     */
    public function review(Request $request, Activity $activity): JsonResponse
    {
        $validated = $request->validate([
            'owner_feedback' => 'nullable|string',
        ]);

        $updatedActivity = $this->activityService->addActivityReview($activity, $validated['owner_feedback']);

        return response()->json([
            'message' => 'Catatan Owner berhasil disimpan.',
            'data' => $updatedActivity,
        ]);
    }
}
