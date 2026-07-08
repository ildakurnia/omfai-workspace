<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Models\User;
use App\Services\UserService;
use Illuminate\Http\JsonResponse;

class UserController extends Controller
{
    protected UserService $userService;

    /**
     * Inject UserService.
     */
    public function __construct(UserService $userService)
    {
        $this->userService = $userService;
    }

    /**
     * Tampilkan semua user (Admin only).
     */
    public function index(): JsonResponse
    {
        \App\Models\Employee::recalculateEmployeeCodes();
        $users = $this->userService->getAllUsers();

        return response()->json([
            'message' => 'Daftar pengguna berhasil dimuat.',
            'data' => $users,
        ]);
    }

    /**
     * Simpan user baru (Admin only).
     */
    public function store(StoreUserRequest $request): JsonResponse
    {
        $user = $this->userService->createUser($request->validated());

        return response()->json([
            'message' => 'Pengguna baru berhasil dibuat.',
            'data' => $user,
        ], 201);
    }

    /**
     * Detail user (Admin only).
     */
    public function show(User $user): JsonResponse
    {
        $user->load(['roles', 'employee.leaveRequests', 'employee.workHourPermissions']);

        if ($user->employee) {
            $attendances = $user->employee->attendances()
                ->orderBy('date', 'desc')
                ->get();
                
            $dates = $attendances->pluck('date')->map(function($d) {
                return $d instanceof \Carbon\Carbon ? $d->toDateString() : $d;
            })->unique()->toArray();

            $earliestCheckIns = \App\Models\Attendance::whereIn('date', $dates)
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

            $attendancesData = $attendances->map(function ($attendance) use ($earliestCheckIns) {
                $dateStr = $attendance->date instanceof \Carbon\Carbon ? $attendance->date->toDateString() : (string)$attendance->date;
                $minCheckIn = $earliestCheckIns[$dateStr] ?? null;
                
                $isEarliest = false;
                if ($attendance->check_in && $minCheckIn && $attendance->check_in === $minCheckIn) {
                    $isEarliest = true;
                }

                $attendance->setAttribute('is_earliest', $isEarliest);
                return $attendance;
            });

            // Set relation explicitly
            $user->employee->setRelation('attendances', $attendancesData);
        }

        return response()->json([
            'message' => 'Detail pengguna berhasil dimuat.',
            'data' => $user,
        ]);
    }

    /**
     * Perbarui data user (Admin only).
     */
    public function update(UpdateUserRequest $request, User $user): JsonResponse
    {
        $updatedUser = $this->userService->updateUser($user, $request->validated());

        return response()->json([
            'message' => 'Data pengguna berhasil diperbarui.',
            'data' => $updatedUser,
        ]);
    }

    /**
     * Hapus user (Admin only).
     */
    public function destroy(User $user): JsonResponse
    {
        $this->userService->deleteUser($user);

        return response()->json([
            'message' => 'Pengguna berhasil dihapus.',
        ]);
    }
}
