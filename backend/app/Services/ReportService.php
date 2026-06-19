<?php

namespace App\Services;

use App\Models\Activity;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;

class ReportService
{
    /**
     * Memfilter data aktivitas untuk kebutuhan pelaporan.
     * 
     * @param array $filters
     * @return Collection
     */
    public function getReportData(array $filters): Collection
    {
        $query = Activity::with(['user', 'category', 'logs'])->latest('created_at');

        // Filter Karyawan
        if (!empty($filters['user_id'])) {
            $query->where('user_id', $filters['user_id']);
        }

        // Filter Kategori
        if (!empty($filters['category_id'])) {
            $query->where('category_id', $filters['category_id']);
        }

        // Filter Status
        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        // Filter Periode (Date Range)
        if (!empty($filters['start_date']) && !empty($filters['end_date'])) {
            $startDate = Carbon::parse($filters['start_date'])->startOfDay();
            $endDate = Carbon::parse($filters['end_date'])->endOfDay();
            $query->whereBetween('created_at', [$startDate, $endDate]);
        }

        return $query->get();
    }

    /**
     * Merender data aktivitas ke dalam format dokumen PDF menggunakan DomPDF.
     * 
     * @param array $filters
     * @return \Barryvdh\DomPDF\PDF
     */
    public function generatePdf(array $filters): \Barryvdh\DomPDF\PDF
    {
        $activities = $this->getReportData($filters);
        
        $startDate = !empty($filters['start_date']) ? Carbon::parse($filters['start_date'])->format('d M Y') : 'Awal';
        $endDate = !empty($filters['end_date']) ? Carbon::parse($filters['end_date'])->format('d M Y') : 'Sekarang';
        
        $period = $startDate . ' - ' . $endDate;

        // Load view blade pdf.report dan ubah ke PDF
        $pdf = Pdf::loadView('pdf.report', [
            'activities' => $activities,
            'period' => $period,
            'filters' => $filters,
        ]);

        // Opsional: Atur ukuran kertas ke A4 Portrait
        $pdf->setPaper('a4', 'portrait');

        return $pdf;
    }
}
