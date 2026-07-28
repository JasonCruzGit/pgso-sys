<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fleet_vehicles', function (Blueprint $table) {
            $table->id();
            $table->string('plate_number')->unique();
            $table->string('name');
            $table->string('vehicle_type'); // sedan, van, pickup, truck, motorcycle, bus, utility
            $table->string('brand')->nullable();
            $table->string('model')->nullable();
            $table->unsignedSmallInteger('year')->nullable();
            $table->string('color')->nullable();
            $table->unsignedSmallInteger('capacity')->nullable();
            $table->string('fuel_type')->nullable();
            $table->string('gps_device_id')->nullable()->unique();
            $table->string('gps_provider')->nullable(); // rest, mqtt, tcp, webhook, custom, simulated
            $table->foreignId('assigned_driver_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status')->default('active'); // active, maintenance, inactive, retired
            $table->string('gps_status')->default('offline'); // online, offline, weak
            $table->string('motion_status')->default('offline'); // moving, idle, parked, offline
            $table->decimal('last_latitude', 10, 7)->nullable();
            $table->decimal('last_longitude', 10, 7)->nullable();
            $table->decimal('last_speed', 8, 2)->nullable();
            $table->decimal('last_heading', 6, 2)->nullable();
            $table->string('engine_status')->nullable(); // on, off, unknown
            $table->timestamp('last_gps_at')->nullable();
            $table->string('last_address')->nullable();
            $table->string('photo_path')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'motion_status']);
            $table->index('vehicle_type');
        });

        Schema::create('fleet_gps_positions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('fleet_vehicle_id')->constrained('fleet_vehicles')->cascadeOnDelete();
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->decimal('speed', 8, 2)->nullable();
            $table->decimal('heading', 6, 2)->nullable();
            $table->decimal('altitude', 8, 2)->nullable();
            $table->unsignedSmallInteger('satellites')->nullable();
            $table->string('engine_status')->nullable();
            $table->string('ignition')->nullable(); // on, off
            $table->boolean('is_stop')->default(false);
            $table->string('address')->nullable();
            $table->string('provider')->nullable();
            $table->json('raw_payload')->nullable();
            $table->timestamp('recorded_at');
            $table->timestamps();

            $table->index(['fleet_vehicle_id', 'recorded_at']);
        });

        Schema::create('fleet_schedules', function (Blueprint $table) {
            $table->id();
            $table->string('schedule_number')->unique();
            $table->foreignId('fleet_vehicle_id')->constrained('fleet_vehicles')->restrictOnDelete();
            $table->foreignId('driver_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('department_id')->constrained()->restrictOnDelete();
            $table->foreignId('requester_id')->constrained('users')->restrictOnDelete();
            $table->string('purpose');
            $table->string('destination');
            $table->dateTime('departure_at');
            $table->dateTime('expected_return_at');
            $table->dateTime('actual_departure_at')->nullable();
            $table->dateTime('actual_return_at')->nullable();
            $table->unsignedSmallInteger('passengers')->default(1);
            $table->string('priority')->default('normal'); // low, normal, high, urgent
            $table->string('status')->default('draft');
            // draft, pending_approval, approved, rejected, scheduled, ongoing, completed, cancelled
            $table->text('remarks')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->json('attachments')->nullable();
            $table->boolean('conflict_override')->default(false);
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'departure_at']);
            $table->index(['fleet_vehicle_id', 'departure_at', 'expected_return_at']);
        });

        Schema::create('fleet_schedule_timeline', function (Blueprint $table) {
            $table->id();
            $table->foreignId('fleet_schedule_id')->constrained('fleet_schedules')->cascadeOnDelete();
            $table->string('event'); // created, submitted, approved, rejected, assigned, started, completed, cancelled, modified
            $table->string('description')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['fleet_schedule_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fleet_schedule_timeline');
        Schema::dropIfExists('fleet_schedules');
        Schema::dropIfExists('fleet_gps_positions');
        Schema::dropIfExists('fleet_vehicles');
    }
};
