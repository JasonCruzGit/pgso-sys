<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gso_inventory_requests', function (Blueprint $table) {
            $table->id();
            $table->string('control_number', 40)->unique();
            $table->dateTime('requested_at')->nullable();

            $table->string('employee_name')->nullable();
            $table->string('office_name')->nullable();

            // A–H request types (single primary selection)
            $table->string('request_type', 40)->nullable();
            $table->boolean('par_is_new')->default(false);
            $table->boolean('par_is_transfer')->default(false);
            $table->boolean('ics_is_new')->default(false);
            $table->boolean('ics_is_transfer')->default(false);

            $table->string('ics_to_name')->nullable();
            $table->string('ics_employee_signature')->nullable();
            $table->string('ics_office')->nullable();
            $table->string('ics_position')->nullable();
            $table->string('ics_id_no')->nullable();

            $table->string('horm_property_or_plate')->nullable();
            $table->string('others_specify')->nullable();

            $table->text('purpose')->nullable();
            $table->string('requester_signature')->nullable();
            $table->string('contact_no')->nullable();

            $table->text('pgso_instruction')->nullable();
            $table->text('remarks')->nullable();
            $table->string('processor_signature')->nullable();

            $table->string('approved_name')->nullable();
            $table->string('approved_position')->nullable();

            $table->foreignId('prepared_by')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('status', ['draft', 'finalized'])->default('draft');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gso_inventory_requests');
    }
};
