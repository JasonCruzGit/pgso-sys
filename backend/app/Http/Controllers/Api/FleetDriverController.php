<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FleetSchedule;
use App\Models\FleetVehicle;
use App\Models\User;
use App\Services\AuditService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FleetDriverController extends Controller
{
    public const LICENSE_STATUSES = ['valid', 'expiring', 'expired', 'pending'];

    public const LICENSE_FIELDS = [
        'driver_license_number',
        'driver_license_type',
        'driver_license_expiry',
        'driver_license_status',
        'driver_license_issued_at',
        'driver_license_restrictions',
        'driver_license_conditions',
        'driver_license_blood_type',
        'driver_license_date_of_birth',
        'driver_license_sex',
        'driver_license_nationality',
        'driver_license_address',
        'driver_license_agency_code',
    ];

    public function __construct(private AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $vehicleDriverIds = FleetVehicle::query()
            ->whereNotNull('assigned_driver_id')
            ->pluck('assigned_driver_id');

        $scheduleDriverIds = FleetSchedule::query()
            ->whereNotNull('driver_id')
            ->pluck('driver_id');

        $driverIds = $vehicleDriverIds->merge($scheduleDriverIds)->unique()->filter()->values();

        $drivers = User::query()
            ->with('department:id,name')
            ->where(function ($q) use ($driverIds) {
                $q->whereIn('id', $driverIds)
                    ->orWhereNotNull('driver_license_number');
            })
            ->when($request->search, function ($q, $s) {
                $q->where(function ($q) use ($s) {
                    $q->where('name', 'ilike', "%{$s}%")
                        ->orWhere('employee_id', 'ilike', "%{$s}%")
                        ->orWhere('email', 'ilike', "%{$s}%")
                        ->orWhere('driver_license_number', 'ilike', "%{$s}%")
                        ->orWhere('driver_license_restrictions', 'ilike', "%{$s}%")
                        ->orWhere('driver_license_agency_code', 'ilike', "%{$s}%");
                });
            })
            ->orderBy('name')
            ->paginate($request->integer('per_page', 25));

        $drivers->getCollection()->transform(fn (User $user) => $this->serializeDriver($user));

        return response()->json($drivers);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'driver_license_number' => ['nullable', 'string', 'max:80'],
            'driver_license_type' => ['nullable', 'string', 'max:50'],
            'driver_license_expiry' => ['nullable', 'date'],
            'driver_license_status' => ['nullable', 'in:'.implode(',', self::LICENSE_STATUSES)],
            'driver_license_issued_at' => ['nullable', 'date'],
            'driver_license_restrictions' => ['nullable', 'string', 'max:100'],
            'driver_license_conditions' => ['nullable', 'string', 'max:100'],
            'driver_license_blood_type' => ['nullable', 'string', 'max:10'],
            'driver_license_date_of_birth' => ['nullable', 'date'],
            'driver_license_sex' => ['nullable', 'string', 'max:20'],
            'driver_license_nationality' => ['nullable', 'string', 'max:80'],
            'driver_license_address' => ['nullable', 'string', 'max:255'],
            'driver_license_agency_code' => ['nullable', 'string', 'max:80'],
        ]);

        if (array_key_exists('driver_license_expiry', $data) && empty($data['driver_license_status'])) {
            $data['driver_license_status'] = $this->resolveDocStatus($data['driver_license_expiry'] ?? null);
        }

        $old = $user->only(self::LICENSE_FIELDS);
        $user->update($data);

        $this->audit->log(
            'update',
            'fleet',
            "Updated driver license for {$user->name}",
            oldValues: $old,
            newValues: $user->fresh()->only(self::LICENSE_FIELDS),
        );

        return response()->json($this->serializeDriver($user->fresh(['department'])));
    }

    private function serializeDriver(User $user): array
    {
        $assigned = FleetVehicle::query()
            ->where('assigned_driver_id', $user->id)
            ->get(['id', 'plate_number', 'name']);

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'employee_id' => $user->employee_id,
            'phone' => $user->phone,
            'department' => $user->department,
            'driver_license_number' => $user->driver_license_number,
            'driver_license_type' => $user->driver_license_type,
            'driver_license_expiry' => $user->driver_license_expiry?->toDateString(),
            'driver_license_status' => $user->driver_license_status,
            'driver_license_issued_at' => $user->driver_license_issued_at?->toDateString(),
            'driver_license_restrictions' => $user->driver_license_restrictions,
            'driver_license_conditions' => $user->driver_license_conditions,
            'driver_license_blood_type' => $user->driver_license_blood_type,
            'driver_license_date_of_birth' => $user->driver_license_date_of_birth?->toDateString(),
            'driver_license_sex' => $user->driver_license_sex,
            'driver_license_nationality' => $user->driver_license_nationality,
            'driver_license_address' => $user->driver_license_address,
            'driver_license_agency_code' => $user->driver_license_agency_code,
            'assigned_vehicles' => $assigned,
        ];
    }

    private function resolveDocStatus(?string $expiry): ?string
    {
        if (! $expiry) {
            return 'pending';
        }

        $date = Carbon::parse($expiry)->startOfDay();
        $today = now()->startOfDay();

        if ($date->lt($today)) {
            return 'expired';
        }
        if ($date->lte($today->copy()->addDays(30))) {
            return 'expiring';
        }

        return 'valid';
    }
}
