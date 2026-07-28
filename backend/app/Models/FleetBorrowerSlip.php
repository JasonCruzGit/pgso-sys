<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class FleetBorrowerSlip extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'slip_number',
        'borrower_name',
        'department_id',
        'contact_no',
        'purpose',
        'destination',
        'departure_at',
        'expected_return_at',
        'passengers',
        'requested_vehicle_type',
        'driver_needed',
        'preferred_driver_note',
        'remarks',
        'requester_id',
        'fleet_schedule_id',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'departure_at' => 'datetime',
            'expected_return_at' => 'datetime',
            'passengers' => 'integer',
            'driver_needed' => 'boolean',
        ];
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(FleetSchedule::class, 'fleet_schedule_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
