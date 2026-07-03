<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

class Employee extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'employee_code',
        'name',
        'joined_at',
        'whatsapp_number',
        'leave_balance',
    ];

    protected $casts = [
        'joined_at' => 'date:Y-m-d',
        'leave_balance' => 'float',
    ];

    /**
     * Recalculate employee codes for all employees sorted by join date.
     */
    public static function recalculateEmployeeCodes()
    {
        $employees = self::orderBy('joined_at', 'asc')
            ->orderBy('id', 'asc')
            ->get();
            
        foreach ($employees as $index => $employee) {
            $datePrefix = Carbon::parse($employee->joined_at)->format('Ymd');
            $sequence = str_pad($index + 1, 2, '0', STR_PAD_LEFT);
            $newCode = $datePrefix . $sequence;
            
            if ($employee->employee_code !== $newCode) {
                $employee->employee_code = $newCode;
                $employee->saveQuietly();
            }
        }
    }

    /**
     * Boot function for model events.
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($employee) {
            if (empty($employee->employee_code)) {
                $datePrefix = Carbon::parse($employee->joined_at)->format('Ymd');
                // Temporary unique code to satisfy NOT NULL constraint before recalculation
                $employee->employee_code = $datePrefix . 'temp' . uniqid();
            }
        });

        static::created(function ($employee) {
            static::recalculateEmployeeCodes();
            $employee->refresh();
        });

        static::updated(function ($employee) {
            if ($employee->isDirty('joined_at')) {
                static::recalculateEmployeeCodes();
                $employee->refresh();
            }
        });

        static::deleted(function ($employee) {
            static::recalculateEmployeeCodes();
        });
    }

    /**
     * Get the user associated with the employee.
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the attendances for the employee.
     */
    public function attendances()
    {
        return $this->hasMany(Attendance::class);
    }

    /**
     * Get the leave requests for the employee.
     */
    public function leaveRequests()
    {
        return $this->hasMany(LeaveRequest::class);
    }

    /**
     * Get the work hour permissions for the employee.
     */
    public function workHourPermissions()
    {
        return $this->hasMany(WorkHourPermission::class);
    }
}
