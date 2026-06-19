<?php

namespace Database\Seeders;

use App\Models\User;
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
        $employee = User::firstOrCreate([
            'email' => 'employee@omfai.com',
        ], [
            'name' => 'Employee OMFAI',
            'password' => Hash::make('password'),
        ]);
        $employee->assignRole('Employee');
    }
}
