<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LeaveRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'employee_id',
        'type',
        'start_date',
        'end_date',
        'reason',
        'attachment',
        'status',
        'rejection_reason',
    ];

    protected $casts = [
        'start_date' => 'date:Y-m-d',
        'end_date' => 'date:Y-m-d',
    ];

    /**
     * Get the employee that owns the leave request.
     */
    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    /**
     * Calculate and get the duration of the leave in days.
     * Saturday counts as 0.5, Sunday & public holidays count as 0.0, Weekdays count as 1.0.
     */
    public function getDurationDaysAttribute()
    {
        $startDate = \Illuminate\Support\Carbon::parse($this->start_date);
        $endDate = \Illuminate\Support\Carbon::parse($this->end_date);
        $requestedDays = 0.0;

        $holidayDates = \App\Models\Holiday::whereBetween('date', [
            $startDate->format('Y-m-d'),
            $endDate->format('Y-m-d')
        ])
        ->pluck('date')
        ->map(fn($date) => \Illuminate\Support\Carbon::parse($date)->format('Y-m-d'))
        ->toArray();

        $currentDate = $startDate->copy();
        while ($currentDate->lte($endDate)) {
            $dateStr = $currentDate->format('Y-m-d');
            if (in_array($dateStr, $holidayDates)) {
                $requestedDays += 0.0;
            } elseif ($currentDate->isSunday()) {
                $requestedDays += 0.0;
            } elseif ($currentDate->isSaturday()) {
                $requestedDays += 0.5;
            } else {
                $requestedDays += 1.0;
            }
            $currentDate->addDay();
        }

        return $requestedDays;
    }
}
