<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Hash;

class UserService
{
    /**
     * Mengambil semua user beserta role-nya.
     * 
     * @return Collection
     */
    public function getAllUsers(): Collection
    {
        return User::with('roles')->get();
    }

    /**
     * Membuat user baru dan mengaitkan role Spatie.
     * 
     * @param array $data
     * @return User
     */
    public function createUser(array $data): User
    {
        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
        ]);

        $user->assignRole($data['role']);

        return $user->load('roles');
    }

    /**
     * Memperbarui data user dan mensinkronkan role Spatie.
     * 
     * @param User $user
     * @param array $data
     * @return User
     */
    public function updateUser(User $user, array $data): User
    {
        $updateData = [
            'name' => $data['name'],
            'email' => $data['email'],
        ];

        if (!empty($data['password'])) {
            $updateData['password'] = Hash::make($data['password']);
        }

        $user->update($updateData);
        $user->syncRoles([$data['role']]);

        return $user->load('roles');
    }

    /**
     * Menghapus user dari database.
     * 
     * @param User $user
     * @return bool|null
     */
    public function deleteUser(User $user): ?bool
    {
        return $user->delete();
    }
}
