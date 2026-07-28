<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pre_post_inspection_repairs', function (Blueprint $table) {
            $table->id();
            $table->string('control_number', 40)->unique();
            $table->date('form_date')->nullable();

            $table->boolean('pre_inspection')->default(false);
            $table->date('pre_inspection_date')->nullable();
            $table->boolean('post_inspection')->default(false);
            $table->date('post_inspection_date')->nullable();

            $table->string('equipment_category', 80)->nullable();
            $table->string('equipment_category_notes')->nullable();

            $table->string('property_no')->nullable();
            $table->string('type')->nullable();
            $table->string('brand')->nullable();
            $table->string('model')->nullable();
            $table->string('engine_no')->nullable();
            $table->string('chassis_no')->nullable();
            $table->string('serial_no')->nullable();
            $table->string('plate_no')->nullable();

            $table->date('date_of_acquisition')->nullable();
            $table->date('date_of_last_repair')->nullable();
            $table->string('location_of_eqpt')->nullable();
            $table->date('date_of_request')->nullable();
            $table->string('office')->nullable();

            $table->string('requisitioner')->nullable();
            $table->string('approved_name')->nullable();
            $table->string('approved_position')->nullable();
            $table->date('approval_date')->nullable();

            $table->string('inspector_1')->nullable();
            $table->string('inspector_2')->nullable();
            $table->string('inspector_3')->nullable();

            $table->foreignId('prepared_by')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('status', ['draft', 'finalized'])->default('draft');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pre_post_inspection_repairs');
    }
};
