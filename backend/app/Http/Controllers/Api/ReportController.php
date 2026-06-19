<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ReportController extends Controller
{
    protected ReportService $reportService;

    /**
     * Inject ReportService.
     */
    public function __construct(ReportService $reportService)
    {
        $this->reportService = $reportService;
    }

    /**
     * Tampilkan data laporan (JSON) untuk preview di web.
     * Hanya dapat diakses oleh Owner dan Admin.
     */
    public function index(Request $request): JsonResponse
    {
        if (!$request->user()->hasAnyRole(['Owner', 'Admin'])) {
            return response()->json([
                'message' => 'Anda tidak memiliki hak akses untuk melihat laporan ini.'
            ], 403);
        }

        $filters = $request->only(['start_date', 'end_date', 'category_id', 'status', 'user_id']);
        $reportData = $this->reportService->getReportData($filters);

        return response()->json([
            'message' => 'Data laporan berhasil dimuat.',
            'data' => $reportData,
        ]);
    }

    /**
     * Unduh laporan format PDF.
     * Hanya dapat diakses oleh Owner dan Admin.
     */
    public function downloadPdf(Request $request): Response|JsonResponse
    {
        if (!$request->user()->hasAnyRole(['Owner', 'Admin'])) {
            return response()->json([
                'message' => 'Anda tidak memiliki hak akses untuk mengunduh laporan ini.'
            ], 403);
        }

        $filters = $request->only(['start_date', 'end_date', 'category_id', 'status', 'user_id']);
        $pdf = $this->reportService->generatePdf($filters);

        return $pdf->download('OMFAI-Workspace-Report-' . date('Ymd-His') . '.pdf');
    }
}
