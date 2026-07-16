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
        Schema::table('leave_requests', function (Blueprint $table) {
            \DB::statement("ALTER TABLE leave_requests MODIFY COLUMN type ENUM('annual_leave', 'sick_leave', 'permission', 'wfh') NOT NULL");
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('leave_requests', function (Blueprint $table) {
            \DB::statement("ALTER TABLE leave_requests MODIFY COLUMN type ENUM('annual_leave', 'sick_leave', 'permission') NOT NULL");
        });
    }
};
