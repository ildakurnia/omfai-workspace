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
        'proof_image',
        'progress_note',
        'completed_at',
        'owner_feedback',
        'feedback_at',
    ];

    protected $appends = [
        'proof_image_url',
    ];

    protected $casts = [
        'status' => ActivityStatusEnum::class,
        'completed_at' => 'datetime',
        'feedback_at' => 'datetime',
    ];

    /**
     * Accessor untuk URL publik gambar bukti.
     */
    public function getProofImageUrlAttribute(): ?string
    {
        if (!$this->proof_image) {
            return null;
        }

        // Dapatkan host dinamis dari request saat ini (misal https://api.domain.com)
        $host = request()->getSchemeAndHttpHost();

        // Jika dijalankan dari CLI atau request tidak memiliki host, gunakan config app.url
        if (app()->runningInConsole() || !$host) {
            $host = rtrim(config('app.url'), '/');
        }

        return $host . '/storage/' . $this->proof_image;
    }

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
