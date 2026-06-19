<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $categories = [
            'Development',
            'Business Analyst',
            'Meeting',
            'Support',
            'Training',
        ];

        foreach ($categories as $name) {
            Category::firstOrCreate([
                'name' => $name,
            ], [
                'is_active' => true,
            ]);
        }
    }
}
