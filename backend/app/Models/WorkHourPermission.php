<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WorkHourPermission extends Model
{
    use HasFactory;

    protected $fillable = [
        'employee_id',
        'date',
        'type',
        'start_time',
        'end_time',
        'reason',
        'attachment',
        'status',
        'rejection_reason',
    ];

    protected $casts = [
        'date' => 'date:Y-m-d',
    ];

    /**
     * Get the employee that owns this work hour permission.
     */
    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }
}
