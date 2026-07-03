<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    protected DashboardService $dashboardService;

    /**
     * Inject DashboardService.
     */
    public function __construct(DashboardService $dashboardService)
    {
        $this->dashboardService = $dashboardService;
    }

    /**
     * Endpoint API Dashboard Summary.
     * Dapat diakses oleh Owner dan Admin.
     * 
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        // Pengamanan tambahan di controller (atau via middleware route)
        if (!$request->user()->hasAnyRole(['Owner', 'Admin'])) {
            return response()->json([
                'message' => 'Anda tidak memiliki hak akses untuk melihat dashboard ini.'
            ], 403);
        }

        $summary = $this->dashboardService->getDashboardSummary();

        return response()->json([
            'message' => 'Data summary dashboard berhasil dimuat.',
            'data' => $summary,
        ]);
    }

    /**
     * Bersihkan cache Laravel (cache, config, route, view).
     * Hanya dapat diakses oleh Owner dan Admin.
     */
    public function clearCache(Request $request): JsonResponse
    {
        if (!$request->user()->hasRole('Admin')) {
            return response()->json([
                'message' => 'Anda tidak memiliki hak akses.'
            ], 403);
        }

        try {
            \Illuminate\Support\Facades\Artisan::call('cache:clear');
            \Illuminate\Support\Facades\Artisan::call('config:clear');
            \Illuminate\Support\Facades\Artisan::call('route:clear');
            \Illuminate\Support\Facades\Artisan::call('view:clear');
            \Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);

            return response()->json([
                'success' => true,
                'message' => 'Cache Laravel & migrasi database berhasil diperbarui!'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal membersihkan cache: ' . $e->getMessage()
            ], 500);
        }
    }
}
