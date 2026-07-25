<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('work_hour_permissions', function (Blueprint $table) {
            $table->time('actual_start_time')->nullable()->after('end_time');
            $table->time('actual_end_time')->nullable()->after('actual_start_time');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('work_hour_permissions', function (Blueprint $table) {
            $table->dropColumn(['actual_start_time', 'actual_end_time']);
        });
    }
};
