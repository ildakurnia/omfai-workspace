<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Carbon;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Dynamic Piket Reminders (menyesuaikan jam pengingat pagi & sore dari Admin)
Schedule::call(function () {
    $nowStr = Carbon::now('Asia/Jakarta')->format('H:i');
    $morningTime = Cache::get('piket_morning_time', '08:00');
    $afternoonTime = Cache::get('piket_afternoon_time', '16:00');

    if ($nowStr === $morningTime) {
        Artisan::call('piket:send-reminder morning');
    }

    if ($nowStr === $afternoonTime) {
        Artisan::call('piket:send-reminder afternoon');
    }
})->everyMinute();

