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
        return response()->json([
            'message' => 'Detail pengguna berhasil dimuat.',
            'data' => $user->load('roles'),
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
