<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FleetGpsPosition extends Model
{
    protected $fillable = [
        'fleet_vehicle_id', 'latitude', 'longitude', 'speed', 'heading', 'altitude',
        'satellites', 'engine_status', 'ignition', 'is_stop', 'address', 'provider',
        'raw_payload', 'recorded_at',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'speed' => 'decimal:2',
            'heading' => 'decimal:2',
            'altitude' => 'decimal:2',
            'satellites' => 'integer',
            'is_stop' => 'boolean',
            'raw_payload' => 'array',
            'recorded_at' => 'datetime',
        ];
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(FleetVehicle::class, 'fleet_vehicle_id');
    }
}
