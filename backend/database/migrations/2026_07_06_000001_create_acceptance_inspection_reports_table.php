<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('acceptance_inspection_reports', function (Blueprint $table) {
            $table->id();
            $table->string('air_number', 50)->unique();
            $table->string('status', 20)->default('draft');
            $table->foreignId('purchase_order_id')->constrained('purchase_orders');
            $table->foreignId('delivery_receipt_id')->nullable()->unique()->constrained('delivery_receipts')->nullOnDelete();
            $table->date('inspection_date');
            $table->date('acceptance_date')->nullable();
            $table->string('place_of_delivery')->nullable();
            $table->string('inspector_name')->nullable();
            $table->string('inspector_position')->nullable();
            $table->string('accepted_by_name')->nullable();
            $table->string('accepted_by_position')->nullable();
            $table->string('supply_officer_name')->nullable();
            $table->string('supply_officer_position')->nullable();
            $table->string('inspection_result', 40)->default('accepted');
            $table->text('findings')->nullable();
            $table->text('remarks')->nullable();
            $table->json('items')->nullable();
            $table->foreignId('prepared_by')->constrained('users');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('acceptance_inspection_reports');
    }
};
