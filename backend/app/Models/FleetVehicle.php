<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class FleetVehicle extends Model
{
    use SoftDeletes;

    public const TYPES = ['sedan', 'van', 'pickup', 'truck', 'motorcycle', 'bus', 'utility'];

    public const STATUSES = ['active', 'maintenance', 'inactive', 'retired'];

    public const MOTION_STATUSES = ['moving', 'idle', 'parked', 'offline'];

    public const DOC_STATUSES = ['valid', 'expiring', 'expired', 'pending'];

    protected $fillable = [
        'plate_number', 'name', 'vehicle_type', 'brand', 'model', 'year', 'color', 'capacity',
        'fuel_type', 'gps_device_id', 'gps_provider', 'assigned_driver_id', 'department_id',
        'status', 'gps_status', 'motion_status', 'last_latitude', 'last_longitude', 'last_speed',
        'last_heading', 'engine_status', 'last_gps_at', 'last_address', 'photo_path', 'notes', 'is_active',
        'cr_number', 'or_number', 'mv_file_number', 'registration_expiry', 'registration_status',
        'registration_issued_at', 'engine_number', 'chassis_number', 'registration_classification',
        'registration_series', 'registration_gross_weight', 'registration_net_weight',
        'registration_piston_displacement', 'registration_lto_office', 'registration_owner_name',
        'registration_amount_paid',
        'insurance_provider', 'insurance_policy_number', 'insurance_coverage_type',
        'insurance_expiry', 'insurance_status',
        'insurance_issued_at', 'insurance_certificate_number', 'insurance_sum_insured',
        'insurance_broker', 'insurance_contact_person', 'insurance_contact_phone', 'insurance_remarks',
    ];

    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'capacity' => 'integer',
            'last_latitude' => 'decimal:7',
            'last_longitude' => 'decimal:7',
            'last_speed' => 'decimal:2',
            'last_heading' => 'decimal:2',
            'last_gps_at' => 'datetime',
            'registration_expiry' => 'date',
            'registration_issued_at' => 'date',
            'registration_gross_weight' => 'decimal:2',
            'registration_net_weight' => 'decimal:2',
            'registration_amount_paid' => 'decimal:2',
            'insurance_expiry' => 'date',
            'insurance_issued_at' => 'date',
            'insurance_sum_insured' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_driver_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function positions(): HasMany
    {
        return $this->hasMany(FleetGpsPosition::class);
    }

    public function schedules(): HasMany
    {
        return $this->hasMany(FleetSchedule::class);
    }

    public function activeSchedule(): ?FleetSchedule
    {
        return $this->schedules()
            ->whereIn('status', ['scheduled', 'ongoing', 'approved'])
            ->where('departure_at', '<=', now()->addHours(1))
            ->where('expected_return_at', '>=', now())
            ->orderBy('departure_at')
            ->first();
    }
}
