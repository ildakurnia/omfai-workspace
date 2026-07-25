<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */

    public function run(): void
    {
        // 1. Jalankan seeder yang WAJIB ada di semua env (lokal & server)
        $this->call([
            RoleSeeder::class,
            CategorySeeder::class,
        ]);

        // 2. Jalankan seeder khusus LOKAL saja untuk keperluan testing
        if (app()->environment('local')) {
            $this->call([
                UserSeeder::class, // Akun dummy (employee@omfai.com, dll)
            ]);

            // Geofence dummy dengan radius besar untuk mempermudah testing lokal
            \App\Models\Geofence::firstOrCreate([
                'name' => 'Office HQ',
            ], [
                'latitude' => -6.200000,
                'longitude' => 106.816666,
                'radius' => 500000, // 500 km radius
            ]);
        }
    }
}


