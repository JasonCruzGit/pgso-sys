<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fleet_borrower_slips', function (Blueprint $table) {
            $table->id();
            $table->string('slip_number')->unique();
            $table->string('borrower_name');
            $table->foreignId('department_id')->constrained()->restrictOnDelete();
            $table->string('contact_no')->nullable();
            $table->string('purpose');
            $table->string('destination');
            $table->dateTime('departure_at');
            $table->dateTime('expected_return_at');
            $table->unsignedSmallInteger('passengers')->default(1);
            $table->string('requested_vehicle_type')->nullable();
            $table->boolean('driver_needed')->default(true);
            $table->string('preferred_driver_note')->nullable();
            $table->text('remarks')->nullable();
            $table->foreignId('requester_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('fleet_schedule_id')->nullable()->constrained('fleet_schedules')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['requester_id', 'created_at']);
            $table->index('fleet_schedule_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fleet_borrower_slips');
    }
};
