<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('received_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('acceptance_inspection_report_id')->constrained()->cascadeOnDelete();
            $table->foreignId('delivery_receipt_id')->nullable()->constrained()->nullOnDelete();
            $table->string('air_number');
            $table->string('dr_number')->nullable();
            $table->string('po_number')->nullable();
            $table->unsignedInteger('line_number');
            $table->string('description');
            $table->string('unit_of_measure', 30)->default('unit');
            $table->decimal('quantity_ordered', 14, 2)->default(0);
            $table->decimal('quantity_delivered', 14, 2)->default(0);
            $table->decimal('quantity_accepted', 14, 2)->default(0);
            $table->decimal('quantity_on_hand', 14, 2)->default(0);
            $table->decimal('unit_cost', 14, 2)->default(0);
            $table->decimal('total_cost', 14, 2)->default(0);
            $table->string('supplier_name')->nullable();
            $table->string('requisitioning_office')->nullable();
            $table->string('storage_location')->nullable();
            $table->date('acceptance_date')->nullable();
            $table->text('remarks')->nullable();
            $table->string('status')->default('available');
            $table->timestamps();

            $table->unique(['acceptance_inspection_report_id', 'line_number']);
            $table->index('air_number');
            $table->index('po_number');
            $table->index('description');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('received_items');
    }
};
