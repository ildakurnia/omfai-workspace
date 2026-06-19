<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCategoryRequest;
use App\Http\Requests\UpdateCategoryRequest;
use App\Models\Category;
use App\Services\CategoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    protected CategoryService $categoryService;

    /**
     * Inject CategoryService.
     */
    public function __construct(CategoryService $categoryService)
    {
        $this->categoryService = $categoryService;
    }

    /**
     * Tampilkan semua kategori master.
     * Jika parameter active_only=1 dikirim, tampilkan yang aktif saja (untuk select option).
     */
    public function index(Request $request): JsonResponse
    {
        if ($request->get('active_only') == 1) {
            $categories = $this->categoryService->getActiveCategories();
        } else {
            $categories = $this->categoryService->getAllCategories();
        }

        return response()->json([
            'message' => 'Daftar kategori berhasil dimuat.',
            'data' => $categories,
        ]);
    }

    /**
     * Simpan kategori master baru (Admin only).
     */
    public function store(StoreCategoryRequest $request): JsonResponse
    {
        $category = $this->categoryService->createCategory($request->validated());

        return response()->json([
            'message' => 'Kategori baru berhasil dibuat.',
            'data' => $category,
        ], 201);
    }

    /**
     * Detail kategori (Admin only).
     */
    public function show(Category $category): JsonResponse
    {
        return response()->json([
            'message' => 'Detail kategori berhasil dimuat.',
            'data' => $category,
        ]);
    }

    /**
     * Perbarui data kategori (Admin only).
     */
    public function update(UpdateCategoryRequest $request, Category $category): JsonResponse
    {
        $updatedCategory = $this->categoryService->updateCategory($category, $request->validated());

        return response()->json([
            'message' => 'Data kategori berhasil diperbarui.',
            'data' => $updatedCategory,
        ]);
    }
}
