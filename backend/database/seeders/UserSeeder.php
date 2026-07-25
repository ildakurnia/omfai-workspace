<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Employee;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Owner User
        $owner = User::firstOrCreate([
            'email' => 'owner@omfai.com',
        ], [
            'name' => 'Owner OMFAI',
            'password' => Hash::make('password'),
        ]);
        $owner->assignRole('Owner');

        // 2. Admin User
        $admin = User::firstOrCreate([
            'email' => 'admin@omfai.com',
        ], [
            'name' => 'Admin OMFAI',
            'password' => Hash::make('password'),
        ]);
        $admin->assignRole('Admin');

        // 3. Employee User
        $employeeUser = User::firstOrCreate([
            'email' => 'employee@omfai.com',
        ], [
            'name' => 'Employee OMFAI',
            'password' => Hash::make('password'),
        ]);
        $employeeUser->assignRole('Employee');

        // Create Employee Profile for Employee User
        if (!Employee::where('user_id', $employeeUser->id)->exists()) {
            Employee::create([
                'user_id' => $employeeUser->id,
                'name' => $employeeUser->name,
                'joined_at' => now()->format('Y-m-d'),
                'whatsapp_number' => '6281234567890',
                'leave_balance' => 12,
            ]);
        }
    }
}

