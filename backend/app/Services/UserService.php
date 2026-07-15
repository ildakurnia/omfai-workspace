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
        return User::with(['roles', 'employee.attendances', 'employee.leaveRequests', 'employee.workHourPermissions'])->get();
    }

    /**
     * Membuat user baru dan mengaitkan role Spatie beserta profile Employee.
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
            'is_active' => $data['is_active'] ?? true,
        ]);

        $user->assignRole($data['role']);

        if ($data['role'] === 'Employee') {
            $user->employee()->create([
                'name' => $data['name'],
                'joined_at' => $data['joined_at'],
                'whatsapp_number' => $data['whatsapp_number'],
                'leave_balance' => $data['leave_balance'] ?? 12,
            ]);
        }

        return $user->load(['roles', 'employee']);
    }

    /**
     * Memperbarui data user dan mensinkronkan role Spatie beserta profile Employee.
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

        if (isset($data['is_active'])) {
            $updateData['is_active'] = (bool)$data['is_active'];
        }

        $user->update($updateData);
        $user->syncRoles([$data['role']]);

        if ($data['role'] === 'Employee') {
            $user->employee()->updateOrCreate(
                ['user_id' => $user->id],
                [
                    'name' => $data['name'],
                    'joined_at' => $data['joined_at'],
                    'whatsapp_number' => $data['whatsapp_number'],
                    'leave_balance' => $data['leave_balance'] ?? 12,
                ]
            );
        } else {
            // Hapus profil karyawan jika diturunkan/diubah ke role Admin/Owner
            $user->employee()->delete();
        }

        return $user->load(['roles', 'employee']);
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
