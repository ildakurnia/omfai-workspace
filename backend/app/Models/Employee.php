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
        'leave_balance' => 'integer',
    ];

    /**
     * Boot function for model events.
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($employee) {
            if (empty($employee->employee_code)) {
                $datePrefix = Carbon::parse($employee->joined_at)->format('Ymd');
                
                // Count employees who joined on the exact same day to calculate NN sequence
                $count = static::whereDate('joined_at', $employee->joined_at)->count();
                $sequence = str_pad($count + 1, 2, '0', STR_PAD_LEFT);
                
                $employee->employee_code = $datePrefix . $sequence;
            }
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
}
