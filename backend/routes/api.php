<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\HolidayController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ActivityController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ReportController;
use Illuminate\Support\Facades\Route;

// Public route
Route::post('/login', [AuthController::class, 'login']);

// Protected routes (Harus login & kirim token Bearer)
Route::middleware('auth:sanctum')->group(function () {
    // Auth endpoints
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);
    Route::post('/upload-avatar', [AuthController::class, 'uploadAvatar']);

    // User Management (Index untuk Owner/Admin, detail & modifikasi Admin Only)
    Route::get('/users', [UserController::class, 'index'])->middleware('role:Owner|Admin');
    Route::middleware('role:Admin')->group(function () {
        Route::post('/users', [UserController::class, 'store']);
        Route::get('/users/{user}', [UserController::class, 'show']);
        Route::put('/users/{user}', [UserController::class, 'update']);
        Route::delete('/users/{user}', [UserController::class, 'destroy']);
    });

    // Holiday Calendar Management
    // Semua user terautentikasi bisa melihat daftar libur untuk perhitungan durasi
    Route::get('/holidays', [HolidayController::class, 'index']);
    // Hanya Admin yang bisa mengelola (store, destroy, sync) hari libur perusahaan
    Route::middleware('role:Admin')->group(function () {
        Route::post('/holidays', [HolidayController::class, 'store']);
        Route::delete('/holidays/{holiday}', [HolidayController::class, 'destroy']);
        Route::post('/holidays/sync', [HolidayController::class, 'sync']);
    });

    // Category Management
    // Semua user terautentikasi bisa melihat (index) kategori aktif
    Route::get('/categories', [CategoryController::class, 'index']);
    // Hanya Admin yang bisa mengelola (store, show, update) kategori
    Route::middleware('role:Admin')->group(function () {
        Route::post('/categories', [CategoryController::class, 'store']);
        Route::get('/categories/{category}', [CategoryController::class, 'show']);
        Route::put('/categories/{category}', [CategoryController::class, 'update']);
    });

    // Activity Management (CRUD internal rules dihandle di ActivityService)
    Route::apiResource('activities', ActivityController::class);
    Route::post('activities/{activity}/review', [ActivityController::class, 'review'])->middleware('role:Owner');

    // Dashboard & Reports (Owner & Admin Only)
    Route::middleware('role:Owner|Admin')->group(function () {
        Route::get('/dashboard', [DashboardController::class, 'index']);
        Route::get('/reports', [ReportController::class, 'index']);
        Route::get('/reports/pdf', [ReportController::class, 'downloadPdf']);
    });
});
