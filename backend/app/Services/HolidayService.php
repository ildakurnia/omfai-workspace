<?php

namespace App\Services;

use App\Models\Holiday;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Http;

class HolidayService
{
    /**
     * Mengambil semua hari libur diurutkan berdasarkan tanggal terdekat.
     * 
     * @return Collection
     */
    public function getAllHolidays(): Collection
    {
        return Holiday::orderBy('date', 'asc')->get();
    }

    /**
     * Menyimpan hari libur kustom baru.
     * 
     * @param array $data
     * @return Holiday
     */
    public function createHoliday(array $data): Holiday
    {
        return Holiday::create([
            'date' => $data['date'],
            'name' => $data['name'],
            'is_custom' => true,
        ]);
    }

    /**
     * Menghapus hari libur tertentu.
     * 
     * @param Holiday $holiday
     * @return bool|null
     */
    public function deleteHoliday(Holiday $holiday): ?bool
    {
        return $holiday->delete();
    }

    /**
     * Menyinkronkan hari libur nasional Indonesia dari Nager.Date API untuk tahun tertentu.
     * 
     * @param int $year
     * @return int Jumlah hari libur baru yang berhasil ditambahkan
     */
    public function syncHolidays(int $year): int
    {
        $response = Http::when(app()->environment('local'), function ($http) {
            return $http->withoutVerifying();
        })->get("https://date.nager.at/api/v3/PublicHolidays/{$year}/ID");

        if (!$response->successful()) {
            throw new \RuntimeException("Gagal terhubung ke API Hari Libur eksternal.");
        }

        $holidays = $response->json();
        $insertedCount = 0;

        foreach ($holidays as $holiday) {
            $record = Holiday::firstOrCreate([
                'date' => $holiday['date']
            ], [
                'name' => $holiday['localName'] ?? $holiday['name'],
                'is_custom' => false
            ]);

            if ($record->wasRecentlyCreated) {
                $insertedCount++;
            }
        }

        return $insertedCount;
    }
}
