<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('waste_management_receipts', function (Blueprint $table) {
            $table->id();
            $table->string('wmr_number')->unique();
            $table->date('disposal_date');
            $table->foreignId('department_id')->constrained();
            $table->string('disposal_location')->nullable();
            $table->string('mode_of_disposal')->nullable();
            $table->text('remarks')->nullable();
            $table->string('status')->default('completed');
            $table->foreignId('prepared_by')->constrained('users');
            $table->string('witness_name')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('waste_management_receipt_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('waste_management_receipt_id')->constrained()->cascadeOnDelete();
            $table->foreignId('inventory_item_id')->nullable()->constrained();
            $table->string('description');
            $table->string('unit_of_measure', 30)->nullable();
            $table->decimal('quantity', 12, 2);
            $table->decimal('unit_cost', 14, 2)->default(0);
            $table->string('item_condition')->nullable();
            $table->string('disposal_reason')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('waste_management_receipt_items');
        Schema::dropIfExists('waste_management_receipts');
    }
};
