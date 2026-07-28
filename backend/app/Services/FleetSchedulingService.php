<?php

namespace App\Services;

use App\Models\FleetBorrowerSlip;
use App\Models\FleetSchedule;
use App\Models\FleetScheduleTimeline;
use App\Models\FleetVehicle;
use App\Models\User;
use App\Traits\GeneratesReference;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class FleetSchedulingService
{
    use GeneratesReference;

    public function __construct(
        private NotificationService $notifications,
        private AuditService $audit,
    ) {}

    /**
     * @return list<string>
     */
    public function detectConflicts(array $data, ?int $ignoreScheduleId = null): array
    {
        $vehicleId = (int) ($data['fleet_vehicle_id'] ?? 0);
        $driverId = ! empty($data['driver_id']) ? (int) $data['driver_id'] : null;
        $start = $data['departure_at'];
        $end = $data['expected_return_at'];
        $conflicts = [];

        $vehicle = FleetVehicle::find($vehicleId);
        if ($vehicle && in_array($vehicle->status, ['maintenance', 'inactive', 'retired'], true)) {
            $conflicts[] = "Vehicle {$vehicle->plate_number} is currently {$vehicle->status} and unavailable.";
        }

        $blocking = ['pending_approval', 'approved', 'scheduled', 'ongoing'];

        $vehicleClash = FleetSchedule::query()
            ->where('fleet_vehicle_id', $vehicleId)
            ->whereIn('status', $blocking)
            ->when($ignoreScheduleId, fn ($q) => $q->where('id', '!=', $ignoreScheduleId))
            ->where('departure_at', '<', $end)
            ->where('expected_return_at', '>', $start)
            ->exists();

        if ($vehicleClash) {
            $conflicts[] = 'Double booking: this vehicle already has an overlapping schedule.';
        }

        if ($driverId) {
            $driverClash = FleetSchedule::query()
                ->where('driver_id', $driverId)
                ->whereIn('status', $blocking)
                ->when($ignoreScheduleId, fn ($q) => $q->where('id', '!=', $ignoreScheduleId))
                ->where('departure_at', '<', $end)
                ->where('expected_return_at', '>', $start)
                ->exists();

            if ($driverClash) {
                $conflicts[] = 'Driver conflict: the selected driver is assigned to another overlapping trip.';
            }
        }

        if ($start >= $end) {
            $conflicts[] = 'Expected return must be after departure.';
        }

        return $conflicts;
    }

    public function create(array $data, User $actor): FleetSchedule
    {
        $conflicts = $this->detectConflicts($data);
        $override = (bool) ($data['conflict_override'] ?? false);

        $timeInvalid = collect($conflicts)->contains(
            fn ($c) => str_contains($c, 'Expected return must be after departure'),
        );

        if ($timeInvalid) {
            throw new InvalidArgumentException('Expected return must be later than departure.');
        }

        if ($conflicts && ! $override) {
            throw new InvalidArgumentException(implode(' ', $conflicts));
        }

        if ($conflicts && $override && ! $actor->hasPermission('fleet.approve')) {
            throw new InvalidArgumentException('Only authorized administrators can override schedule conflicts.');
        }

        return DB::transaction(function () use ($data, $actor, $override) {
            $status = $data['status'] ?? 'pending_approval';
            if (! in_array($status, FleetSchedule::STATUSES, true)) {
                $status = 'pending_approval';
            }

            $schedule = FleetSchedule::create([
                'schedule_number' => $this->generateReference('FLT-', 'fleet_schedules', 'schedule_number'),
                'fleet_vehicle_id' => $data['fleet_vehicle_id'],
                'driver_id' => $data['driver_id'] ?? null,
                'department_id' => $data['department_id'],
                'requester_id' => $data['requester_id'] ?? $actor->id,
                'purpose' => $data['purpose'],
                'destination' => $data['destination'],
                'departure_at' => $data['departure_at'],
                'expected_return_at' => $data['expected_return_at'],
                'passengers' => $data['passengers'] ?? 1,
                'priority' => $data['priority'] ?? 'normal',
                'status' => $status,
                'remarks' => $data['remarks'] ?? null,
                'attachments' => $data['attachments'] ?? null,
                'conflict_override' => $override,
                'created_by' => $actor->id,
                'updated_by' => $actor->id,
            ]);

            $this->timeline($schedule, 'created', 'Schedule request created', $actor);
            if ($status === 'pending_approval') {
                $this->timeline($schedule, 'submitted', 'Submitted for approval', $actor);
                $this->notifyApprovers($schedule);
            }

            $this->audit->log('create', 'fleet', "Created fleet schedule {$schedule->schedule_number}", newValues: $schedule->toArray());

            if (! empty($data['borrower_slip_id'])) {
                FleetBorrowerSlip::query()
                    ->where('id', (int) $data['borrower_slip_id'])
                    ->whereNull('fleet_schedule_id')
                    ->update(['fleet_schedule_id' => $schedule->id, 'updated_by' => $actor->id]);
            }

            return $schedule->load($this->defaultRelations());
        });
    }

    public function update(FleetSchedule $schedule, array $data, User $actor): FleetSchedule
    {
        if (in_array($schedule->status, ['completed', 'cancelled'], true)) {
            throw new InvalidArgumentException('Completed or cancelled schedules cannot be edited.');
        }

        $payload = array_merge($schedule->only([
            'fleet_vehicle_id', 'driver_id', 'department_id', 'departure_at', 'expected_return_at',
        ]), $data);

        $conflicts = $this->detectConflicts($payload, $schedule->id);
        $override = (bool) ($data['conflict_override'] ?? $schedule->conflict_override);

        $timeInvalid = collect($conflicts)->contains(
            fn ($c) => str_contains($c, 'Expected return must be after departure'),
        );

        if ($timeInvalid) {
            throw new InvalidArgumentException('Expected return must be later than departure.');
        }

        if ($conflicts && ! $override) {
            throw new InvalidArgumentException(implode(' ', $conflicts));
        }

        $old = $schedule->toArray();

        $schedule->update([
            ...collect($data)->only([
                'fleet_vehicle_id', 'driver_id', 'department_id', 'requester_id', 'purpose', 'destination',
                'departure_at', 'expected_return_at', 'passengers', 'priority', 'remarks', 'attachments',
            ])->filter(fn ($v) => $v !== null)->all(),
            'conflict_override' => $override,
            'updated_by' => $actor->id,
        ]);

        $this->timeline($schedule, 'modified', 'Schedule details updated', $actor);
        $this->notifyParty($schedule, 'fleet_schedule_modified', 'Schedule Modified', "Fleet schedule {$schedule->schedule_number} was updated.");

        $this->audit->log('update', 'fleet', "Updated fleet schedule {$schedule->schedule_number}", oldValues: $old, newValues: $schedule->fresh()->toArray());

        return $schedule->fresh($this->defaultRelations());
    }

    public function approve(FleetSchedule $schedule, User $actor): FleetSchedule
    {
        if (! in_array($schedule->status, ['pending_approval', 'draft'], true)) {
            throw new InvalidArgumentException('Only pending schedules can be approved.');
        }

        $schedule->update([
            'status' => 'scheduled',
            'approved_by' => $actor->id,
            'approved_at' => now(),
            'updated_by' => $actor->id,
        ]);

        $this->timeline($schedule, 'approved', 'Schedule approved and marked as scheduled', $actor);
        $this->notifyParty($schedule, 'fleet_schedule_approved', 'Schedule Approved', "Your vehicle schedule {$schedule->schedule_number} has been approved.");

        $this->audit->log('approve', 'fleet', "Approved fleet schedule {$schedule->schedule_number}");

        return $schedule->fresh($this->defaultRelations());
    }

    public function reject(FleetSchedule $schedule, User $actor, string $reason): FleetSchedule
    {
        if ($schedule->status !== 'pending_approval') {
            throw new InvalidArgumentException('Only pending schedules can be rejected.');
        }

        $schedule->update([
            'status' => 'rejected',
            'rejection_reason' => $reason,
            'approved_by' => $actor->id,
            'approved_at' => now(),
            'updated_by' => $actor->id,
        ]);

        $this->timeline($schedule, 'rejected', "Rejected: {$reason}", $actor);
        $this->notifyParty($schedule, 'fleet_schedule_rejected', 'Schedule Rejected', "Schedule {$schedule->schedule_number} was rejected. Reason: {$reason}");

        $this->audit->log('reject', 'fleet', "Rejected fleet schedule {$schedule->schedule_number}");

        return $schedule->fresh($this->defaultRelations());
    }

    public function cancel(FleetSchedule $schedule, User $actor, ?string $reason = null): FleetSchedule
    {
        if (in_array($schedule->status, ['completed', 'cancelled'], true)) {
            throw new InvalidArgumentException('Schedule is already closed.');
        }

        $schedule->update([
            'status' => 'cancelled',
            'remarks' => trim(($schedule->remarks ? $schedule->remarks."\n" : '').($reason ? "Cancelled: {$reason}" : 'Cancelled')),
            'updated_by' => $actor->id,
        ]);

        $this->timeline($schedule, 'cancelled', $reason ? "Cancelled: {$reason}" : 'Schedule cancelled', $actor);
        $this->notifyParty($schedule, 'fleet_schedule_cancelled', 'Schedule Cancelled', "Fleet schedule {$schedule->schedule_number} was cancelled.");

        $this->audit->log('cancel', 'fleet', "Cancelled fleet schedule {$schedule->schedule_number}");

        return $schedule->fresh($this->defaultRelations());
    }

    public function startTrip(FleetSchedule $schedule, User $actor): FleetSchedule
    {
        if (! in_array($schedule->status, ['scheduled', 'approved'], true)) {
            throw new InvalidArgumentException('Only scheduled trips can be started.');
        }

        $schedule->update([
            'status' => 'ongoing',
            'actual_departure_at' => now(),
            'updated_by' => $actor->id,
        ]);

        $this->timeline($schedule, 'started', 'Trip started', $actor);
        $this->audit->log('start', 'fleet', "Started fleet trip {$schedule->schedule_number}");

        return $schedule->fresh($this->defaultRelations());
    }

    public function completeTrip(FleetSchedule $schedule, User $actor): FleetSchedule
    {
        if ($schedule->status !== 'ongoing') {
            throw new InvalidArgumentException('Only ongoing trips can be completed.');
        }

        $schedule->update([
            'status' => 'completed',
            'actual_return_at' => now(),
            'updated_by' => $actor->id,
        ]);

        $this->timeline($schedule, 'completed', 'Trip completed', $actor);
        $this->audit->log('complete', 'fleet', "Completed fleet trip {$schedule->schedule_number}");

        return $schedule->fresh($this->defaultRelations());
    }

    public function autoTransitionStatuses(): int
    {
        $changed = 0;

        FleetSchedule::query()
            ->where('status', 'scheduled')
            ->where('departure_at', '<=', now())
            ->where('expected_return_at', '>', now())
            ->each(function (FleetSchedule $schedule) use (&$changed) {
                $schedule->update([
                    'status' => 'ongoing',
                    'actual_departure_at' => $schedule->actual_departure_at ?? now(),
                ]);
                $this->timeline($schedule, 'started', 'Auto-started based on departure time');
                $changed++;
            });

        FleetSchedule::query()
            ->where('status', 'ongoing')
            ->where('expected_return_at', '<', now()->subHours(2))
            ->each(function (FleetSchedule $schedule) {
                $this->notifyParty(
                    $schedule,
                    'fleet_vehicle_overdue',
                    'Vehicle Overdue',
                    "Trip {$schedule->schedule_number} ({$schedule->vehicle?->plate_number}) is overdue for return.",
                );
            });

        FleetSchedule::query()
            ->whereIn('status', ['scheduled', 'approved'])
            ->whereBetween('departure_at', [now(), now()->addHours(2)])
            ->each(function (FleetSchedule $schedule) {
                $this->notifyParty(
                    $schedule,
                    'fleet_upcoming_trip',
                    'Upcoming Trip',
                    "Trip {$schedule->schedule_number} to {$schedule->destination} departs soon.",
                );
            });

        return $changed;
    }

    private function timeline(FleetSchedule $schedule, string $event, ?string $description = null, ?User $user = null, ?array $meta = null): void
    {
        FleetScheduleTimeline::create([
            'fleet_schedule_id' => $schedule->id,
            'event' => $event,
            'description' => $description,
            'user_id' => $user?->id ?? auth('api')->id(),
            'meta' => $meta,
        ]);
    }

    private function notifyApprovers(FleetSchedule $schedule): void
    {
        $officers = User::query()
            ->whereHas('role', fn ($q) => $q->whereIn('slug', ['system_administrator', 'fleet_officer']))
            ->where('is_active', true)
            ->get();

        $this->notifications->notify(
            $officers,
            'fleet_schedule_pending',
            'Fleet Schedule Pending Approval',
            "Schedule {$schedule->schedule_number} for {$schedule->vehicle?->plate_number} requires approval.",
            ['fleet_schedule_id' => $schedule->id],
        );
    }

    private function notifyParty(FleetSchedule $schedule, string $type, string $title, string $message): void
    {
        $users = collect([$schedule->requester, $schedule->driver])->filter();
        if ($users->isEmpty()) {
            return;
        }

        $this->notifications->notify($users, $type, $title, $message, ['fleet_schedule_id' => $schedule->id]);
    }

    private function defaultRelations(): array
    {
        return ['vehicle', 'driver', 'department', 'requester', 'approver', 'timeline.user'];
    }
}
