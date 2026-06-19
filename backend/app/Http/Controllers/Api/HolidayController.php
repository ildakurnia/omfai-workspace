<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreHolidayRequest;
use App\Models\Holiday;
use App\Services\HolidayService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HolidayController extends Controller
{
    protected HolidayService $holidayService;

    public function __construct(HolidayService $holidayService)
    {
        $this->holidayService = $holidayService;
    }

    /**
     * Tampilkan semua hari libur (Semua User terautentikasi).
     */
    public function index(): JsonResponse
    {
        $holidays = $this->holidayService->getAllHolidays();

        return response()->json([
            'message' => 'Daftar hari libur berhasil dimuat.',
            'data' => $holidays,
        ]);
    }

    /**
     * Simpan hari libur kustom baru (Admin only).
     */
    public function store(StoreHolidayRequest $request): JsonResponse
    {
        $holiday = $this->holidayService->createHoliday($request->validated());

        return response()->json([
            'message' => 'Hari libur baru berhasil ditambahkan.',
            'data' => $holiday,
        ], 201);
    }

    /**
     * Hapus hari libur tertentu (Admin only).
     */
    public function destroy(Holiday $holiday): JsonResponse
    {
        $this->holidayService->deleteHoliday($holiday);

        return response()->json([
            'message' => 'Hari libur berhasil dihapus.',
        ]);
    }

    /**
     * Sinkronisasikan hari libur nasional dari Nager.Date API (Admin only).
     */
    public function sync(Request $request): JsonResponse
    {
        $year = $request->input('year', date('Y'));

        try {
            $insertedCount = $this->holidayService->syncHolidays((int)$year);
            $holidays = $this->holidayService->getAllHolidays();

            return response()->json([
                'message' => "Sinkronisasi berhasil. Berhasil menyinkronkan {$insertedCount} hari libur baru.",
                'data' => $holidays,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => $e->getMessage() ?? 'Gagal menyinkronkan hari libur nasional.',
            ], 502);
        }
    }
}
