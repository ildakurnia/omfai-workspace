<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthService
{
    /**
     * Logika untuk memproses login pengguna.
     * 
     * @param array $credentials
     * @return array
     * @throws ValidationException
     */
    public function login(array $credentials): array
    {
        $user = User::where('email', $credentials['email'])->first();

        if (!$user || !Hash::check($credentials['password'], $user['password'])) {
            throw ValidationException::withMessages([
                'email' => ['Email atau password yang Anda masukkan salah.'],
            ]);
        }

        // Generate Sanctum token
        $token = $user->createToken('auth_token')->plainTextToken;

        // Ambil daftar role pengguna dari Spatie (biasanya satu role untuk sistem ini)
        $roles = $user->getRoleNames();

        return [
            'user' => [
                'id' => $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'avatar' => $user['avatar'],
                'avatar_url' => $user['avatar'] ? asset('storage/' . $user['avatar']) : null,
                'roles' => $roles,
                'created_at' => $user['created_at'] ? $user['created_at']->toIso8601String() : null,
            ],
            'access_token' => $token,
            'token_type' => 'Bearer',
        ];
    }

    /**
     * Logika untuk memproses logout pengguna (menghapus token saat ini).
     * 
     * @param User $user
     * @return bool
     */
    public function logout(User $user): bool
    {
        return $user->currentAccessToken()->delete();
    }

    /**
     * Logika untuk mengganti password pengguna saat ini.
     * 
     * @param User $user
     * @param array $data
     * @return bool
     * @throws ValidationException
     */
    public function changePassword(User $user, array $data): bool
    {
        if (!Hash::check($data['current_password'], $user['password'])) {
            throw ValidationException::withMessages([
                'current_password' => ['Password saat ini salah.'],
            ]);
        }

        $user['password'] = Hash::make($data['new_password']);
        return $user->save();
    }
}
