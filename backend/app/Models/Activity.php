<?php

namespace App\Models;

use App\Enums\ActivityStatusEnum;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Activity extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'category_id',
        'activity',
        'status',
        'hold_reason',
        'reference_link',
        'progress_note',
        'completed_at',
        'owner_feedback',
        'feedback_at',
    ];

    protected $casts = [
        'status' => ActivityStatusEnum::class,
        'completed_at' => 'datetime',
        'feedback_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function logs()
    {
        return $this->hasMany(ActivityLog::class);
    }
}
