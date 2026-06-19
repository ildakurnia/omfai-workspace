<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AuthController extends Controller
{
    protected AuthService $authService;

    /**
     * Inject AuthService ke dalam Controller.
     */
    public function __construct(AuthService $authService)
    {
        $this->authService = $authService;
    }

    /**
     * Endpoint API Login.
     * 
     * @param Request $request
     * @return JsonResponse
     */
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $result = $this->authService->login($credentials);

        return response()->json([
            'message' => 'Login berhasil.',
            'data' => $result,
        ]);
    }

    /**
     * Endpoint API Logout.
     * 
     * @param Request $request
     * @return JsonResponse
     */
    public function logout(Request $request): JsonResponse
    {
        $this->authService->logout($request->user());

        return response()->json([
            'message' => 'Logout berhasil.',
        ]);
    }

    /**
     * Endpoint API Get Profile (Me).
     * 
     * @param Request $request
     * @return JsonResponse
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'message' => 'Profile berhasil dimuat.',
            'data' => [
                'id' => $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'avatar' => $user['avatar'],
                'avatar_url' => $user['avatar'] ? asset('storage/' . $user['avatar']) : null,
                'roles' => $user->getRoleNames(),
                'created_at' => $user['created_at'] ? $user['created_at']->toIso8601String() : null,
            ],
        ]);
    }

    /**
     * Endpoint API Ganti Password.
     * 
     * @param Request $request
     * @return JsonResponse
     */
    public function changePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|confirmed',
        ]);

        $this->authService->changePassword($request->user(), $data);

        return response()->json([
            'message' => 'Password berhasil diubah.',
        ]);
    }

    /**
     * Endpoint API Upload/Update Avatar.
     * 
     * @param Request $request
     * @return JsonResponse
     */
    public function uploadAvatar(Request $request): JsonResponse
    {
        $request->validate([
            'avatar' => 'required|image|mimes:jpeg,png,jpg,gif|max:2048',
        ]);

        $user = $request->user();

        // Hapus avatar lama jika ada
        if ($user->avatar) {
            Storage::disk('public')->delete($user->avatar);
        }

        // Simpan file avatar baru
        $path = $request->file('avatar')->store('profile_photos', 'public');

        $user->avatar = $path;
        $user->save();

        return response()->json([
            'message' => 'Foto profil berhasil diperbarui.',
            'data' => [
                'avatar' => $path,
                'avatar_url' => asset('storage/' . $path),
            ]
        ]);
    }
}
