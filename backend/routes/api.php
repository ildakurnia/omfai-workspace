<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\HolidayController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ActivityController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\AttendanceApiController;
use App\Http\Controllers\Api\LeaveApiController;
use App\Http\Controllers\Api\LeaveApprovalController;
use App\Http\Controllers\Api\GeofenceApiController;
use App\Http\Controllers\Api\WorkHourPermissionController;
use App\Http\Controllers\Api\PiketApiController;
use Illuminate\Support\Facades\Route;

// Public routes
Route::post('/login', [AuthController::class, 'login']);
Route::get('/piket/confirm/{token}', [PiketApiController::class, 'getConfirmDetails']);
Route::post('/piket/confirm/{token}', [PiketApiController::class, 'submitConfirm']);

// Protected routes (Harus login & kirim token Bearer)
Route::middleware(['auth:sanctum', 'check.active'])->group(function () {
    // Auth endpoints
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);
    Route::post('/upload-avatar', [AuthController::class, 'uploadAvatar']);

    // User Management (Index & Show untuk Owner/Admin, modifikasi Admin Only)
    Route::get('/users', [UserController::class, 'index'])->middleware('role:Owner|Admin');
    Route::get('/users/{user}', [UserController::class, 'show'])->middleware('role:Owner|Admin');
    Route::middleware('role:Admin')->group(function () {
        Route::post('/users', [UserController::class, 'store']);
        Route::put('/users/{user}', [UserController::class, 'update']);
        Route::patch('/users/{user}/toggle', [UserController::class, 'toggleStatus']);
        Route::delete('/users/{user}', [UserController::class, 'destroy']);
        Route::post('/admin/clear-cache', [DashboardController::class, 'clearCache']);
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

    // Dashboard & Champions (Semua role terautentikasi)
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/dashboard/early-bird-champions', [DashboardController::class, 'getEarlyBirdChampions']);

    // Reports (Owner & Admin Only)
    Route::middleware('role:Owner|Admin')->group(function () {
        Route::get('/reports', [ReportController::class, 'index']);
        Route::get('/reports/pdf', [ReportController::class, 'downloadPdf']);
    });

    // Attendance & Geofencing Module
    Route::post('/absen', [AttendanceApiController::class, 'tap']);
    Route::post('/istirahat', [AttendanceApiController::class, 'istirahat']);
    Route::get('/history-absen', [AttendanceApiController::class, 'history']);
    Route::get('/geofences', [GeofenceApiController::class, 'index']);

    // Leave & Permission Module
    Route::post('/ajukan-cuti', [LeaveApiController::class, 'store']);
    Route::get('/history-cuti', [LeaveApiController::class, 'history']);
    Route::post('/ajukan-cuti/{id}/cancel', [LeaveApiController::class, 'cancel']);

    // Work Hour Permission Module
    Route::post('/work-hour-permissions', [WorkHourPermissionController::class, 'store']);
    Route::get('/work-hour-permissions', [WorkHourPermissionController::class, 'history']);
    Route::post('/work-hour-permissions/{id}/cancel', [WorkHourPermissionController::class, 'cancel']);
    Route::post('/keluar-sementara', [WorkHourPermissionController::class, 'tapOutTemporary']);

    // Piket & Kebersihan Module
    Route::get('/piket/today', [PiketApiController::class, 'today']);
    Route::get('/piket/schedules', [PiketApiController::class, 'getSchedules']);
    Route::get('/piket/settings', [PiketApiController::class, 'getSettings']);
    Route::get('/piket/employees', [PiketApiController::class, 'getEmployees']);

    // Piket Management (Admin only)
    Route::middleware('role:Admin')->group(function () {
        Route::post('/piket/schedules/day', [PiketApiController::class, 'updateDaySchedule']);
        Route::post('/piket/reassign-today', [PiketApiController::class, 'reassignToday']);
        Route::post('/piket/settings', [PiketApiController::class, 'updateSettings']);
        Route::post('/piket/test-wa', [PiketApiController::class, 'testWa']);
    });

    // Leave Approvals & Geofence Settings (Owner & Admin)
    Route::middleware('role:Owner|Admin')->group(function () {
        Route::get('/leave-requests', [LeaveApprovalController::class, 'index']);
        Route::post('/leave-requests/{id}/approve', [LeaveApprovalController::class, 'approve']);
        Route::post('/leave-requests/{id}/reject', [LeaveApprovalController::class, 'reject']);
        Route::delete('/leave-requests/{id}', [LeaveApprovalController::class, 'destroy']);
        Route::delete('/attendances/{id}', [AttendanceApiController::class, 'destroy'])->middleware('role:Admin');

        // Work Hour Permission Approvals
        Route::get('/admin/work-hour-permissions', [WorkHourPermissionController::class, 'index']);
        Route::post('/admin/work-hour-permissions/{id}/approve', [WorkHourPermissionController::class, 'approve']);
        Route::post('/admin/work-hour-permissions/{id}/reject', [WorkHourPermissionController::class, 'reject']);
        Route::delete('/admin/work-hour-permissions/{id}', [WorkHourPermissionController::class, 'destroy']);

        // Geofence Management
        Route::post('/geofences', [GeofenceApiController::class, 'store']);
        Route::put('/geofences/{id}', [GeofenceApiController::class, 'update']);
        Route::delete('/geofences/{id}', [GeofenceApiController::class, 'destroy']);
    });
});

