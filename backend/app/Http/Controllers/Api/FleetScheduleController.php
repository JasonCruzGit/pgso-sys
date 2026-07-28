<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FleetSchedule;
use App\Services\AuditService;
use App\Services\FleetSchedulingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

class FleetScheduleController extends Controller
{
    public function __construct(
        private FleetSchedulingService $scheduling,
        private AuditService $audit,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $schedules = FleetSchedule::with(['vehicle', 'driver', 'department', 'requester', 'approver'])
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->fleet_vehicle_id, fn ($q, $id) => $q->where('fleet_vehicle_id', $id))
            ->when($request->department_id, fn ($q, $id) => $q->where('department_id', $id))
            ->when($request->from, fn ($q, $from) => $q->where('departure_at', '>=', $from))
            ->when($request->to, fn ($q, $to) => $q->where('departure_at', '<=', $to))
            ->when($request->search, fn ($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('schedule_number', 'ilike', "%{$s}%")
                    ->orWhere('destination', 'ilike', "%{$s}%")
                    ->orWhere('purpose', 'ilike', "%{$s}%")
                    ->orWhereHas('vehicle', fn ($q) => $q->where('plate_number', 'ilike', "%{$s}%"));
            }))
            ->orderByDesc('departure_at')
            ->paginate($request->integer('per_page', 25));

        return response()->json($schedules);
    }

    public function calendar(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date'],
            'view' => ['nullable', 'in:month,week,day'],
        ]);

        $schedules = FleetSchedule::with(['vehicle', 'driver', 'department', 'requester'])
            ->where('departure_at', '<=', $data['to'])
            ->where('expected_return_at', '>=', $data['from'])
            ->whereNotIn('status', ['cancelled', 'rejected', 'draft'])
            ->orderBy('departure_at')
            ->get();

        return response()->json(['data' => $schedules, 'view' => $data['view'] ?? 'week']);
    }

    public function show(FleetSchedule $fleetSchedule): JsonResponse
    {
        return response()->json($fleetSchedule->load([
            'vehicle', 'driver', 'department', 'requester', 'approver', 'timeline.user',
        ]));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        try {
            $schedule = $this->scheduling->create($data, $request->user());
        } catch (InvalidArgumentException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'conflicts' => $this->scheduling->detectConflicts($data),
            ], 422);
        }

        return response()->json($schedule, 201);
    }

    public function update(Request $request, FleetSchedule $fleetSchedule): JsonResponse
    {
        $data = $this->validated($request, false);

        try {
            $schedule = $this->scheduling->update($fleetSchedule, $data, $request->user());
        } catch (InvalidArgumentException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'conflicts' => $this->scheduling->detectConflicts(
                    array_merge($fleetSchedule->only([
                        'fleet_vehicle_id', 'driver_id', 'departure_at', 'expected_return_at',
                    ]), $data),
                    $fleetSchedule->id,
                ),
            ], 422);
        }

        return response()->json($schedule);
    }

    public function checkConflicts(Request $request): JsonResponse
    {
        $data = $request->validate([
            'fleet_vehicle_id' => ['required', 'exists:fleet_vehicles,id'],
            'driver_id' => ['nullable', 'exists:users,id'],
            'departure_at' => ['required', 'date'],
            'expected_return_at' => ['required', 'date', 'after:departure_at'],
            'ignore_schedule_id' => ['nullable', 'exists:fleet_schedules,id'],
        ]);

        return response()->json([
            'conflicts' => $this->scheduling->detectConflicts($data, $data['ignore_schedule_id'] ?? null),
        ]);
    }

    public function approve(Request $request, FleetSchedule $fleetSchedule): JsonResponse
    {
        try {
            return response()->json($this->scheduling->approve($fleetSchedule, $request->user()));
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function reject(Request $request, FleetSchedule $fleetSchedule): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']]);

        try {
            return response()->json($this->scheduling->reject($fleetSchedule, $request->user(), $data['reason']));
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function cancel(Request $request, FleetSchedule $fleetSchedule): JsonResponse
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);

        try {
            return response()->json($this->scheduling->cancel($fleetSchedule, $request->user(), $data['reason'] ?? null));
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function start(Request $request, FleetSchedule $fleetSchedule): JsonResponse
    {
        try {
            return response()->json($this->scheduling->startTrip($fleetSchedule, $request->user()));
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function complete(Request $request, FleetSchedule $fleetSchedule): JsonResponse
    {
        try {
            return response()->json($this->scheduling->completeTrip($fleetSchedule, $request->user()));
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function reports(Request $request): JsonResponse
    {
        $from = $request->input('from', now()->startOfMonth()->toDateString());
        $to = $request->input('to', now()->endOfMonth()->toDateString());

        $base = FleetSchedule::query()
            ->whereBetween('departure_at', [$from, $to.' 23:59:59']);

        $byStatus = (clone $base)
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $byDepartment = (clone $base)
            ->with('department')
            ->get()
            ->groupBy(fn ($s) => $s->department?->name ?? 'Unassigned')
            ->map->count();

        $utilization = FleetSchedule::query()
            ->with('vehicle')
            ->whereBetween('departure_at', [$from, $to.' 23:59:59'])
            ->whereIn('status', ['completed', 'ongoing', 'scheduled'])
            ->get()
            ->groupBy('fleet_vehicle_id')
            ->map(function ($rows) {
                $vehicle = $rows->first()->vehicle;

                return [
                    'vehicle' => $vehicle?->only(['id', 'plate_number', 'name', 'vehicle_type']),
                    'trips' => $rows->count(),
                    'completed' => $rows->where('status', 'completed')->count(),
                ];
            })
            ->values();

        $drivers = FleetSchedule::query()
            ->with('driver')
            ->whereBetween('departure_at', [$from, $to.' 23:59:59'])
            ->whereNotNull('driver_id')
            ->get()
            ->groupBy('driver_id')
            ->map(function ($rows) {
                return [
                    'driver' => $rows->first()->driver?->only(['id', 'name', 'employee_id']),
                    'assignments' => $rows->count(),
                ];
            })
            ->values();

        $this->audit->log('export', 'fleet', "Viewed fleet reports {$from} to {$to}");

        return response()->json([
            'from' => $from,
            'to' => $to,
            'by_status' => $byStatus,
            'by_department' => $byDepartment,
            'utilization' => $utilization,
            'driver_history' => $drivers,
            'upcoming' => FleetSchedule::with(['vehicle', 'driver', 'department'])
                ->whereIn('status', ['scheduled', 'approved'])
                ->where('departure_at', '>=', now())
                ->orderBy('departure_at')
                ->limit(20)
                ->get(),
            'completed' => FleetSchedule::with(['vehicle', 'driver', 'department'])
                ->where('status', 'completed')
                ->whereBetween('departure_at', [$from, $to.' 23:59:59'])
                ->orderByDesc('actual_return_at')
                ->limit(50)
                ->get(),
            'cancelled' => FleetSchedule::with(['vehicle', 'driver', 'department'])
                ->where('status', 'cancelled')
                ->whereBetween('departure_at', [$from, $to.' 23:59:59'])
                ->orderByDesc('updated_at')
                ->limit(50)
                ->get(),
        ]);
    }

    private function validated(Request $request, bool $creating = true): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return $request->validate([
            'fleet_vehicle_id' => [$required, 'exists:fleet_vehicles,id'],
            'driver_id' => ['nullable', 'exists:users,id'],
            'department_id' => [$required, 'exists:departments,id'],
            'requester_id' => ['nullable', 'exists:users,id'],
            'purpose' => [$required, 'string', 'max:500'],
            'destination' => [$required, 'string', 'max:255'],
            'departure_at' => [$required, 'date'],
            'expected_return_at' => [$required, 'date', 'after:departure_at'],
            'passengers' => ['nullable', 'integer', 'min:1', 'max:60'],
            'priority' => ['nullable', 'in:'.implode(',', FleetSchedule::PRIORITIES)],
            'remarks' => ['nullable', 'string'],
            'attachments' => ['nullable', 'array'],
            'status' => ['nullable', 'in:'.implode(',', FleetSchedule::STATUSES)],
            'conflict_override' => ['nullable', 'boolean'],
            'borrower_slip_id' => ['nullable', 'exists:fleet_borrower_slips,id'],
        ]);
    }
}
