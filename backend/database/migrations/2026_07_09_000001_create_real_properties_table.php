<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('real_properties', function (Blueprint $table) {
            $table->id();
            $table->string('property_code', 50)->unique();
            $table->string('name');
            $table->string('property_type', 50);
            $table->text('description')->nullable();
            $table->string('address')->nullable();
            $table->string('municipality', 100)->nullable();
            $table->string('barangay', 100)->nullable();
            $table->decimal('land_area_sqm', 14, 2)->nullable();
            $table->decimal('building_area_sqm', 14, 2)->nullable();
            $table->string('status', 30)->default('active');
            $table->date('acquisition_date')->nullable();
            $table->decimal('estimated_value', 16, 2)->nullable();
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $table->string('managing_office')->nullable();
            $table->string('contact_person')->nullable();
            $table->string('contact_number', 30)->nullable();
            $table->text('remarks')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('property_type');
            $table->index('status');
            $table->index('municipality');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('real_properties');
    }
};
