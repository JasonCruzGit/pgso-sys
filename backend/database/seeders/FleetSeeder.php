<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\FleetSchedule;
use App\Models\FleetScheduleTimeline;
use App\Models\FleetVehicle;
use App\Models\User;
use App\Services\FleetGpsService;
use Illuminate\Database\Seeder;

class FleetSeeder extends Seeder
{
    public function run(): void
    {
        $pgso = Department::where('code', 'PGSO')->first();
        $pho = Department::where('code', 'PHO')->first();
        $peo = Department::where('code', 'PEO')->first();

        $admin = User::where('email', 'admin@gso.palawan.gov.ph')->first();
        $officer = User::where('email', 'officer@gso.palawan.gov.ph')->first();
        $driverA = User::where('email', 'jason.cruz@pgso.palawan.gov.ph')->first() ?? $officer;
        $driverB = User::where('email', 'kenneth.panganiban@pvo.palawan.gov.ph')->first() ?? $admin;

        $vehicles = [
            [
                'plate_number' => 'PGO-1401',
                'name' => 'Provincial Service Sedan 1',
                'vehicle_type' => 'sedan',
                'brand' => 'Toyota',
                'model' => 'Vios',
                'year' => 2023,
                'color' => 'White',
                'capacity' => 4,
                'fuel_type' => 'Gasoline',
                'gps_device_id' => 'GPS-PGP-1401',
                'gps_provider' => 'simulated',
                'assigned_driver_id' => $driverA?->id,
                'department_id' => $pgso?->id,
                'status' => 'active',
                'last_latitude' => 9.73920,
                'last_longitude' => 118.73530,
            ],
            [
                'plate_number' => 'PGO-2208',
                'name' => 'PGSO Utility Van',
                'vehicle_type' => 'van',
                'brand' => 'Toyota',
                'model' => 'Hiace',
                'year' => 2022,
                'color' => 'Silver',
                'capacity' => 12,
                'fuel_type' => 'Diesel',
                'gps_device_id' => 'GPS-PGP-2208',
                'gps_provider' => 'simulated',
                'assigned_driver_id' => $driverB?->id,
                'department_id' => $pgso?->id,
                'status' => 'active',
                'last_latitude' => 9.74210,
                'last_longitude' => 118.73890,
            ],
            [
                'plate_number' => 'PHO-3310',
                'name' => 'PHO Ambulance Support',
                'vehicle_type' => 'utility',
                'brand' => 'Nissan',
                'model' => 'Urvan',
                'year' => 2021,
                'color' => 'White',
                'capacity' => 8,
                'fuel_type' => 'Diesel',
                'gps_device_id' => 'GPS-PGP-3310',
                'gps_provider' => 'simulated',
                'assigned_driver_id' => $driverA?->id,
                'department_id' => $pho?->id,
                'status' => 'active',
                'last_latitude' => 9.74500,
                'last_longitude' => 118.73350,
            ],
            [
                'plate_number' => 'PEO-4502',
                'name' => 'Engineering Pickup',
                'vehicle_type' => 'pickup',
                'brand' => 'Isuzu',
                'model' => 'D-Max',
                'year' => 2020,
                'color' => 'Blue',
                'capacity' => 5,
                'fuel_type' => 'Diesel',
                'gps_device_id' => 'GPS-PGP-4502',
                'gps_provider' => 'simulated',
                'department_id' => $peo?->id,
                'status' => 'maintenance',
                'motion_status' => 'offline',
                'gps_status' => 'offline',
                'last_latitude' => 9.73680,
                'last_longitude' => 118.73650,
            ],
            [
                'plate_number' => 'PGO-8815',
                'name' => 'Capitol Shuttle Bus',
                'vehicle_type' => 'bus',
                'brand' => 'Hino',
                'model' => 'RK1J',
                'year' => 2019,
                'color' => 'Green',
                'capacity' => 30,
                'fuel_type' => 'Diesel',
                'gps_device_id' => 'GPS-PGP-8815',
                'gps_provider' => 'simulated',
                'department_id' => $pgso?->id,
                'status' => 'active',
                'last_latitude' => 9.75020,
                'last_longitude' => 118.72840,
            ],
        ];

        foreach ($vehicles as $data) {
            FleetVehicle::updateOrCreate(
                ['plate_number' => $data['plate_number']],
                [
                    ...$data,
                    'is_active' => true,
                    'motion_status' => $data['motion_status'] ?? 'parked',
                    'gps_status' => $data['gps_status'] ?? 'online',
                    'last_speed' => 0,
                    'engine_status' => 'off',
                    'last_gps_at' => now()->subMinutes(2),
                    'last_address' => 'Provincial Capitol, Puerto Princesa City, Palawan',
                ],
            );
        }

        $sedan = FleetVehicle::where('plate_number', 'PGO-1401')->first();
        $van = FleetVehicle::where('plate_number', 'PGO-2208')->first();

        if ($sedan && $pgso && $admin) {
            $schedule = FleetSchedule::updateOrCreate(
                ['schedule_number' => 'FLT-DEMO-0001'],
                [
                    'fleet_vehicle_id' => $sedan->id,
                    'driver_id' => $driverA?->id,
                    'department_id' => $pgso->id,
                    'requester_id' => $admin->id,
                    'purpose' => 'Official coordination meeting at Provincial Capitol satellite office',
                    'destination' => 'San Pedro Extension Office, Puerto Princesa City',
                    'departure_at' => now()->addDay()->setTime(8, 0),
                    'expected_return_at' => now()->addDay()->setTime(12, 0),
                    'passengers' => 3,
                    'priority' => 'normal',
                    'status' => 'scheduled',
                    'remarks' => 'Demo seeded schedule',
                    'approved_by' => $officer?->id ?? $admin->id,
                    'approved_at' => now()->subDay(),
                    'created_by' => $admin->id,
                    'updated_by' => $admin->id,
                ],
            );

            if ($schedule->timeline()->count() === 0) {
                FleetScheduleTimeline::create([
                    'fleet_schedule_id' => $schedule->id,
                    'event' => 'created',
                    'description' => 'Demo schedule created',
                    'user_id' => $admin->id,
                ]);
                FleetScheduleTimeline::create([
                    'fleet_schedule_id' => $schedule->id,
                    'event' => 'approved',
                    'description' => 'Approved for dispatch',
                    'user_id' => $officer?->id ?? $admin->id,
                ]);
            }
        }

        if ($van && $pho && $admin) {
            FleetSchedule::updateOrCreate(
                ['schedule_number' => 'FLT-DEMO-0002'],
                [
                    'fleet_vehicle_id' => $van->id,
                    'driver_id' => $driverB?->id,
                    'department_id' => $pho->id,
                    'requester_id' => $admin->id,
                    'purpose' => 'Medical supply delivery to district hospital',
                    'destination' => 'Aborlan District Hospital',
                    'departure_at' => now()->subHours(2),
                    'expected_return_at' => now()->addHours(4),
                    'actual_departure_at' => now()->subHours(2),
                    'passengers' => 2,
                    'priority' => 'high',
                    'status' => 'ongoing',
                    'created_by' => $admin->id,
                    'updated_by' => $admin->id,
                ],
            );
        }

        app(FleetGpsService::class)->refreshSimulatedVehicles();
    }
}
