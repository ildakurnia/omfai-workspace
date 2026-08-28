<?php

namespace App\Http\Controllers\Api;

use App\Helpers\WhatsAppHelper;
use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\PiketLog;
use App\Models\PiketSchedule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class PiketApiController extends Controller
{
    /**
     * Get today's piket status & schedule.
     */
    public function today(Request $request): JsonResponse
    {
        $date = $request->query('date', Carbon::now('Asia/Jakarta')->toDateString());
        $carbonDate = Carbon::parse($date, 'Asia/Jakarta');
        $dayOfWeek = $carbonDate->format('l');

        // Auto-seed default schedules if empty
        $this->ensureDefaultSchedules();

        $schedules = PiketSchedule::with('employee.user')
            ->where('day_of_week', $dayOfWeek)
            ->where('is_active', true)
            ->get();

        $dutyEmployeeIds = $schedules->pluck('employee_id')->filter()->unique();

        foreach ($dutyEmployeeIds as $empId) {
            PiketLog::firstOrCreate(
                ['date' => $date, 'employee_id' => $empId],
                ['token' => Str::random(12)]
            );
        }

        $logs = PiketLog::with('employee.user')
            ->whereDate('date', $date)
            ->get();

        $dutyEmployees = [];
        $logList = [];

        foreach ($logs as $log) {
            if ($log->employee) {
                $dutyEmployees[] = [
                    'id' => $log->employee->id,
                    'name' => $log->employee->name,
                    'employee_code' => $log->employee->employee_code,
                    'avatar_url' => ($log->employee->user && $log->employee->user->avatar) ? asset('storage/' . $log->employee->user->avatar) : null,
                ];

                $logList[] = [
                    'id' => $log->id,
                    'employee_id' => $log->employee_id,
                    'employee_name' => $log->employee->name,
                    'is_completed' => (bool) $log->is_completed,
                    'completed_at' => $log->completed_at ? $log->completed_at->toIso8601String() : null,
                    'morning_wa_sent' => !is_null($log->morning_wa_sent_at),
                    'afternoon_wa_sent' => !is_null($log->afternoon_wa_sent_at),
                    'proof_image_url' => $log->proof_image_path ? asset('storage/' . $log->proof_image_path) : null,
                    'notes' => $log->notes,
                    'token' => $log->token,
                ];
            }
        }

        $firstEmp = count($dutyEmployees) > 0 ? $dutyEmployees[0] : null;
        $firstLog = count($logList) > 0 ? $logList[0] : null;

        $now = Carbon::now('Asia/Jakarta');
        $morningTime = Cache::get('piket_morning_time', '08:00');
        $afternoonTime = Cache::get('piket_afternoon_time', '16:00');

        return response()->json([
            'success' => true,
            'data' => [
                'date' => $date,
                'day_name' => $dayOfWeek,
                'current_time' => $now->format('H:i'),
                'morning_time' => $morningTime,
                'afternoon_time' => $afternoonTime,
                'duty_employees' => $dutyEmployees,
                'logs' => $logList,
                'duty_employee' => $firstEmp,
                'log' => $firstLog,
            ],
        ]);
    }

    /**
     * Get details for public/direct confirmation link.
     */
    public function getConfirmDetails(string $token): JsonResponse
    {
        $log = PiketLog::with('employee.user')->where('token', $token)->first();

        if (!$log) {
            return response()->json([
                'success' => false,
                'message' => 'Token konfirmasi piket tidak ditemukan atau sudah kadaluarsa.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'date' => $log->date->toDateString(),
                'employee_name' => $log->employee ? $log->employee->name : 'N/A',
                'is_completed' => (bool) $log->is_completed,
                'completed_at' => $log->completed_at ? $log->completed_at->toIso8601String() : null,
                'proof_image_url' => $log->proof_image_path ? asset('storage/' . $log->proof_image_path) : null,
                'notes' => $log->notes,
            ],
        ]);
    }

    /**
     * Submit confirmation & optional photo upload.
     */
    public function submitConfirm(Request $request, string $token): JsonResponse
    {
        $log = PiketLog::with('employee')->where('token', $token)->first();

        if (!$log) {
            return response()->json([
                'success' => false,
                'message' => 'Token konfirmasi piket tidak ditemukan.',
            ], 404);
        }

        $request->validate([
            'proof_image' => 'nullable|image|max:5120',
            'notes' => 'nullable|string|max:255',
        ]);

        if ($request->hasFile('proof_image')) {
            $file = $request->file('proof_image');
            $filename = 'piket_' . $log->date->format('Y-m-d') . '_' . time() . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('piket_proofs', $filename, 'public');
            $log->proof_image_path = $path;
        }

        if ($request->filled('notes')) {
            $log->notes = $request->input('notes');
        }

        $log->is_completed = true;
        $log->completed_at = now();
        $log->save();

        // Send automatic WhatsApp notification to Owner
        $ownerNumber = config('services.whatsapp.owner_number');
        if (!empty($ownerNumber)) {
            $employeeName = $log->employee ? $log->employee->name : 'N/A';
            $dateFormatted = Carbon::parse($log->date)->translatedFormat('l, d F Y');
            $proofUrlStr = $log->proof_image_path ? asset('storage/' . $log->proof_image_path) : 'Tidak ada foto (opsional)';

            $waMessage = "🔔 LAPORAN PIKET SELESAI\n\n"
                       . "Petugas {$employeeName} telah menyelesaikan tugas piket hari ini ({$dateFormatted}).\n"
                       . "Status Ceklis: ✅ Selesai\n"
                       . "Foto Bukti: {$proofUrlStr}";

            if ($log->notes) {
                $waMessage .= "\nCatatan: \"{$log->notes}\"";
            }

            WhatsAppHelper::sendMessage($ownerNumber, $waMessage);
        }

        return response()->json([
            'success' => true,
            'message' => 'Konfirmasi piket berhasil disimpan dan notifikasi telah dikirim ke Owner.',
            'data' => [
                'is_completed' => true,
                'completed_at' => $log->completed_at->toIso8601String(),
                'proof_image_url' => $log->proof_image_path ? asset('storage/' . $log->proof_image_path) : null,
                'notes' => $log->notes,
            ],
        ]);
    }

    /**
     * Get all weekly piket schedules (Monday-Friday).
     */
    public function getSchedules(): JsonResponse
    {
        $this->ensureDefaultSchedules();

        $schedules = PiketSchedule::with('employee')
            ->where('is_active', true)
            ->get()
            ->groupBy('day_of_week');

        $days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        $result = [];

        foreach ($days as $day) {
            $daySchedules = $schedules->get($day, collect());
            $result[] = [
                'day_of_week' => $day,
                'employee_ids' => $daySchedules->pluck('employee_id')->toArray(),
                'employees' => $daySchedules->pluck('employee')->filter()->values(),
            ];
        }

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    /**
     * Get list of employees for piket schedule selection.
     */
    public function getEmployees(): JsonResponse
    {
        $employees = \App\Models\Employee::orderBy('name', 'asc')->get();

        return response()->json([
            'success' => true,
            'data' => $employees,
        ]);
    }

    /**
     * Update piket schedule for a specific day with multiple employee IDs.
     */
    public function updateDaySchedule(Request $request): JsonResponse
    {
        $request->validate([
            'day_of_week' => 'required|in:Monday,Tuesday,Wednesday,Thursday,Friday',
            'employee_ids' => 'present|array',
            'employee_ids.*' => 'exists:employees,id',
        ]);

        $day = $request->input('day_of_week');
        $employeeIds = array_unique($request->input('employee_ids', []));

        PiketSchedule::where('day_of_week', $day)->delete();

        foreach ($employeeIds as $empId) {
            PiketSchedule::create([
                'day_of_week' => $day,
                'employee_id' => $empId,
                'is_active' => true,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => "Jadwal piket untuk hari {$day} berhasil diperbarui.",
        ]);
    }

    /**
     * Reassign/swap today's piket duty employee (Owner & Admin only).
     */
    public function reassignToday(Request $request): JsonResponse
    {
        $request->validate([
            'employee_id' => 'required|exists:employees,id',
            'date' => 'nullable|date',
        ]);

        $date = $request->input('date', Carbon::now('Asia/Jakarta')->toDateString());

        $log = PiketLog::firstOrCreate(
            ['date' => $date],
            [
                'employee_id' => $request->input('employee_id'),
                'token' => Str::random(40),
            ]
        );

        $log->employee_id = $request->input('employee_id');
        $log->save();

        return response()->json([
            'success' => true,
            'message' => 'Petugas piket hari ini berhasil diubah/ditukar.',
            'data' => $log->load('employee.user'),
        ]);
    }

    /**
     * Auto-seed default schedules if empty.
     */
    private function ensureDefaultSchedules()
    {
        if (PiketSchedule::count() > 0) {
            return;
        }

        $allEmployees = Employee::all();
        if ($allEmployees->isEmpty()) {
            return;
        }

        $defaultMapping = [
            'Monday' => 'Bella',
            'Tuesday' => 'Dian',
            'Wednesday' => 'Najwa',
            'Thursday' => 'Ilda',
            'Friday' => 'Rofiki',
        ];

        $days = array_keys($defaultMapping);

        foreach ($days as $idx => $day) {
            $nameSearch = $defaultMapping[$day];
            $emp = Employee::where('name', 'like', "%{$nameSearch}%")->first();
            if (!$emp && $nameSearch === 'Rofiki') {
                $emp = Employee::where('name', 'like', "%Fiki%")->first();
            }

            if (!$emp) {
                $emp = $allEmployees[$idx % $allEmployees->count()];
            }

            if ($emp) {
                PiketSchedule::create([
                    'day_of_week' => $day,
                    'employee_id' => $emp->id,
                    'is_active' => true,
                ]);
            }
        }
    }

    /**
     * Get piket reminder time settings.
     */
    public function getSettings(): JsonResponse
    {
        $morningTime = Cache::get('piket_morning_time', '08:00');
        $afternoonTime = Cache::get('piket_afternoon_time', '16:00');

        return response()->json([
            'success' => true,
            'data' => [
                'morning_time' => $morningTime,
                'afternoon_time' => $afternoonTime,
            ],
        ]);
    }

    /**
     * Update piket reminder time settings (Owner & Admin only).
     */
    public function updateSettings(Request $request): JsonResponse
    {
        $request->validate([
            'morning_time' => 'required|string',
            'afternoon_time' => 'required|string',
        ]);

        Cache::forever('piket_morning_time', $request->input('morning_time'));
        Cache::forever('piket_afternoon_time', $request->input('afternoon_time'));

        return response()->json([
            'success' => true,
            'message' => 'Pengaturan jam pengingat piket berhasil disimpan.',
            'data' => [
                'morning_time' => $request->input('morning_time'),
                'afternoon_time' => $request->input('afternoon_time'),
            ],
        ]);
    }

    /**
     * Test sending WhatsApp piket reminder immediately (Owner & Admin only).
     */
    public function testWa(Request $request): JsonResponse
    {
        $request->validate([
            'session' => 'required|in:morning,afternoon',
        ]);

        $session = $request->input('session');
        $now = Carbon::now('Asia/Jakarta');
        $todayStr = $now->toDateString();
        $dayOfWeek = $now->format('l');

        $this->ensureDefaultSchedules();

        $schedules = PiketSchedule::with('employee')
            ->where('day_of_week', $dayOfWeek)
            ->where('is_active', true)
            ->get();

        if ($schedules->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => "Tidak ada jadwal piket aktif untuk hari {$dayOfWeek}.",
            ], 400);
        }

        $frontendUrl = rtrim(config('services.frontend.url', 'http://localhost:3000'), '/');
        $sentCount = 0;
        $employeeNames = [];

        foreach ($schedules as $schedule) {
            $employee = $schedule->employee;
            if (!$employee || empty($employee->whatsapp_number)) {
                continue;
            }

            $piketLog = PiketLog::firstOrCreate(
                ['date' => $todayStr, 'employee_id' => $employee->id],
                ['token' => Str::random(12)]
            );

            $confirmUrl = "{$frontendUrl}/piket/confirm?token={$piketLog->token}";

            if ($session === 'morning') {
                $message = "Halo {$employee->name}! 🌸\n\n"
                         . "Jangan lupa siram bunga hari ini yaa 🪴\n\n"
                         . "Jika sudah selesai, mohon konfirmasi / upload foto (opsional) di sini:\n"
                         . "👉 {$confirmUrl}";

                if (WhatsAppHelper::sendMessage($employee->whatsapp_number, $message)) {
                    $piketLog->morning_wa_sent_at = now();
                    $piketLog->save();
                    $sentCount++;
                    $employeeNames[] = $employee->name;
                }
            } else {
                $message = "Halo {$employee->name}! 🌇\n\n"
                         . "Jangan lupa buang sampah sebelum pulang hari ini yaa 🗑️\n\n"
                         . "Jika sudah selesai, mohon konfirmasi / upload foto (opsional) di sini:\n"
                         . "👉 {$confirmUrl}";

                if (WhatsAppHelper::sendMessage($employee->whatsapp_number, $message)) {
                    $piketLog->afternoon_wa_sent_at = now();
                    $piketLog->save();
                    $sentCount++;
                    $employeeNames[] = $employee->name;
                }
            }
        }

        if ($sentCount > 0) {
            $namesStr = implode(', ', $employeeNames);
            return response()->json([
                'success' => true,
                'message' => "Pesan WA piket ({$session}) berhasil dikirim ke: {$namesStr}.",
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => "Gagal mengirimkan pesan WA. Pastikan nomor WhatsApp karyawan sudah terkonfigurasi.",
        ], 500);
    }
}
