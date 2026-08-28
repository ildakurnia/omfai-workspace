<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PiketLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'date',
        'employee_id',
        'morning_wa_sent_at',
        'afternoon_wa_sent_at',
        'is_completed',
        'completed_at',
        'proof_image_path',
        'notes',
        'token',
    ];

    protected $casts = [
        'date' => 'date:Y-m-d',
        'is_completed' => 'boolean',
        'morning_wa_sent_at' => 'datetime',
        'afternoon_wa_sent_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }
}
