<?php

namespace App\Services;

use App\Models\Category;
use Illuminate\Database\Eloquent\Collection;

class CategoryService
{
    /**
     * Mengambil seluruh master kategori (aktif & tidak aktif).
     * 
     * @return Collection
     */
    public function getAllCategories(): Collection
    {
        return Category::all();
    }

    /**
     * Mengambil kategori yang aktif saja untuk dropdown karyawan.
     * 
     * @return Collection
     */
    public function getActiveCategories(): Collection
    {
        return Category::where('is_active', true)->get();
    }

    /**
     * Membuat kategori master baru.
     * 
     * @param array $data
     * @return Category
     */
    public function createCategory(array $data): Category
    {
        return Category::create([
            'name' => $data['name'],
            'is_active' => $data['is_active'] ?? true,
        ]);
    }

    /**
     * Memperbarui data kategori.
     * 
     * @param Category $category
     * @param array $data
     * @return Category
     */
    public function updateCategory(Category $category, array $data): Category
    {
        $category->update([
            'name' => $data['name'],
            'is_active' => $data['is_active'],
        ]);

        return $category;
    }
}
