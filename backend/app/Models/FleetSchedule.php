<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class FleetSchedule extends Model
{
    use SoftDeletes;

    public const STATUSES = [
        'draft',
        'pending_approval',
        'approved',
        'rejected',
        'scheduled',
        'ongoing',
        'completed',
        'cancelled',
    ];

    public const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

    protected $fillable = [
        'schedule_number', 'fleet_vehicle_id', 'driver_id', 'department_id', 'requester_id',
        'purpose', 'destination', 'departure_at', 'expected_return_at', 'actual_departure_at',
        'actual_return_at', 'passengers', 'priority', 'status', 'remarks', 'rejection_reason',
        'attachments', 'conflict_override', 'approved_by', 'approved_at', 'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'departure_at' => 'datetime',
            'expected_return_at' => 'datetime',
            'actual_departure_at' => 'datetime',
            'actual_return_at' => 'datetime',
            'approved_at' => 'datetime',
            'passengers' => 'integer',
            'attachments' => 'array',
            'conflict_override' => 'boolean',
        ];
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(FleetVehicle::class, 'fleet_vehicle_id');
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'driver_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function timeline(): HasMany
    {
        return $this->hasMany(FleetScheduleTimeline::class)->orderBy('created_at');
    }
}
