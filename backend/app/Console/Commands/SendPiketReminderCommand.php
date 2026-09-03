<?php

namespace App\Console\Commands;

use App\Helpers\WhatsAppHelper;
use App\Models\Employee;
use App\Models\Holiday;
use App\Models\PiketLog;
use App\Models\PiketSchedule;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class SendPiketReminderCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'piket:send-reminder {time=morning : morning or afternoon}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send automatic WhatsApp reminder to daily piket duty employee';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $time = strtolower($this->argument('time'));
        if (!in_array($time, ['morning', 'afternoon'])) {
            $this->error("Invalid time argument. Use 'morning' or 'afternoon'.");
            return 1;
        }

        $now = Carbon::now('Asia/Jakarta');
        $todayStr = $now->toDateString();
        $dayOfWeek = $now->format('l'); // Monday, Tuesday, etc.

        // Weekend check
        if ($now->isSunday() || $now->isSaturday()) {
            $this->info("Skipping piket reminder: {$dayOfWeek} is weekend.");
            return 0;
        }

        // Public holiday check
        if (Holiday::whereDate('date', $todayStr)->exists()) {
            $this->info("Skipping piket reminder: Today ({$todayStr}) is a public holiday.");
            return 0;
        }

        // Ensure default schedule exists if table is empty
        $this->ensureDefaultSchedules();

        $schedules = PiketSchedule::with('employee')
            ->where('day_of_week', $dayOfWeek)
            ->where('is_active', true)
            ->get();

        if ($schedules->isEmpty()) {
            $this->warn("No active piket schedule found for {$dayOfWeek}.");
            return 0;
        }

        $frontendUrl = rtrim(config('services.frontend.url', 'http://localhost:3000'), '/');

        foreach ($schedules as $schedule) {
            $employee = $schedule->employee;
            if (!$employee || empty($employee->whatsapp_number)) {
                $this->warn("Skipping schedule: Employee missing or has no WA number.");
                continue;
            }

            // Get or create today's piket log for this employee
            $piketLog = PiketLog::firstOrCreate(
                [
                    'date' => $todayStr,
                    'employee_id' => $employee->id,
                ],
                [
                    'token' => Str::random(12),
                ]
            );

            $confirmUrl = "{$frontendUrl}/piket/confirm.html?token={$piketLog->token}";

            if ($time === 'morning') {
                if ($piketLog->morning_wa_sent_at) {
                    $this->info("Morning reminder already sent today to {$employee->name}.");
                    continue;
                }

                $message = "Halo {$employee->name}! 🌸\n\n"
                         . "Jangan lupa siram bunga hari ini yaa 🪴\n\n"
                         . "Jika sudah selesai, mohon konfirmasi / upload foto (opsional) di sini:\n"
                         . "👉 {$confirmUrl}";

                if (WhatsAppHelper::sendMessage($employee->whatsapp_number, $message)) {
                    $piketLog->morning_wa_sent_at = now();
                    $piketLog->save();
                    $this->info("Morning piket reminder sent to {$employee->name} ({$employee->whatsapp_number}).");
                }
            } elseif ($time === 'afternoon') {
                if ($piketLog->afternoon_wa_sent_at) {
                    $this->info("Afternoon reminder already sent today to {$employee->name}.");
                    continue;
                }

                $message = "Halo {$employee->name}! 🌇\n\n"
                         . "Jangan lupa buang sampah sebelum pulang hari ini yaa 🗑️\n\n"
                         . "Jika sudah selesai, mohon konfirmasi / upload foto (opsional) di sini:\n"
                         . "👉 {$confirmUrl}";

                if (WhatsAppHelper::sendMessage($employee->whatsapp_number, $message)) {
                    $piketLog->afternoon_wa_sent_at = now();
                    $piketLog->save();
                    $this->info("Afternoon piket reminder sent to {$employee->name} ({$employee->whatsapp_number}).");
                }
            }
        }

        return 0;
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

            // Fallback to existing employee if named employee not found
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
}
