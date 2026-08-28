<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('piket_schedules', function (Blueprint $table) {
            $table->id();
            $table->enum('day_of_week', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
            $table->foreignId('employee_id')->constrained('employees')->onDelete('cascade');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('piket_logs', function (Blueprint $table) {
            $table->id();
            $table->date('date');
            $table->foreignId('employee_id')->constrained('employees')->onDelete('cascade');
            $table->timestamp('morning_wa_sent_at')->nullable();
            $table->timestamp('afternoon_wa_sent_at')->nullable();
            $table->timestamp('morning_completed_at')->nullable();
            $table->timestamp('afternoon_completed_at')->nullable();
            $table->boolean('is_completed')->default(false);
            $table->timestamp('completed_at')->nullable();
            $table->string('proof_image_path')->nullable();
            $table->string('notes')->nullable();
            $table->string('token', 64)->unique();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('piket_logs');
        Schema::dropIfExists('piket_schedules');
    }
};
