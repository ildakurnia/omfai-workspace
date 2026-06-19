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
}
