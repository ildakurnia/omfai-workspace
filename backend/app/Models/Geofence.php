<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Geofence extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'latitude',
        'longitude',
        'radius',
    ];

    protected $casts = [
        'latitude' => 'double',
        'longitude' => 'double',
        'radius' => 'integer',
    ];
}
