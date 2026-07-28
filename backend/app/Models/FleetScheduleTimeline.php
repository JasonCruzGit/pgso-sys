<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FleetScheduleTimeline extends Model
{
    protected $table = 'fleet_schedule_timeline';

    protected $fillable = [
        'fleet_schedule_id', 'event', 'description', 'user_id', 'meta',
    ];

    protected function casts(): array
    {
        return [
            'meta' => 'array',
        ];
    }

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(FleetSchedule::class, 'fleet_schedule_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
