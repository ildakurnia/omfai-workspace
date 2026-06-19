<?php

namespace App\Models;

use App\Enums\ActivityStatusEnum;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ActivityLog extends Model
{
    use HasFactory;

    // Menonaktifkan updated_at karena log hanya dicatat sekali (tidak ada update)
    const UPDATED_AT = null;

    protected $fillable = [
        'activity_id',
        'status',
        'changed_by',
    ];

    protected $casts = [
        'status' => ActivityStatusEnum::class,
    ];

    public function activity()
    {
        return $this->belongsTo(Activity::class);
    }

    public function changedByUser()
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
