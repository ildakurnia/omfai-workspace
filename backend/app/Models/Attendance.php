<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Attendance extends Model
{
    use HasFactory;

    protected $fillable = [
        'employee_id',
        'date',
        'check_in',
        'check_out',
        'break_start',
        'break_end',
        'status',
    ];

    protected $casts = [
        'date' => 'date:Y-m-d',
        // time attributes don't strictly need casting or can be cast to string / custom format
    ];

    /**
     * Get the employee that owns the attendance.
     */
    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }
}
