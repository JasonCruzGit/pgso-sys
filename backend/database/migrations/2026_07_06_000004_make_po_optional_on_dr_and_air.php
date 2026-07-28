<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('delivery_receipts', function (Blueprint $table) {
            $table->dropForeign(['purchase_order_id']);
        });

        DB::statement('ALTER TABLE delivery_receipts ALTER COLUMN purchase_order_id DROP NOT NULL');

        Schema::table('delivery_receipts', function (Blueprint $table) {
            $table->string('po_number', 100)->nullable()->after('purchase_order_id');
            $table->foreign('purchase_order_id')->references('id')->on('purchase_orders')->nullOnDelete();
        });

        Schema::table('acceptance_inspection_reports', function (Blueprint $table) {
            $table->dropForeign(['purchase_order_id']);
        });

        DB::statement('ALTER TABLE acceptance_inspection_reports ALTER COLUMN purchase_order_id DROP NOT NULL');

        Schema::table('acceptance_inspection_reports', function (Blueprint $table) {
            $table->string('po_number', 100)->nullable()->after('purchase_order_id');
            $table->foreign('purchase_order_id')->references('id')->on('purchase_orders')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('delivery_receipts', function (Blueprint $table) {
            $table->dropForeign(['purchase_order_id']);
            $table->dropColumn('po_number');
        });

        DB::statement('ALTER TABLE delivery_receipts ALTER COLUMN purchase_order_id SET NOT NULL');

        Schema::table('delivery_receipts', function (Blueprint $table) {
            $table->foreign('purchase_order_id')->references('id')->on('purchase_orders');
        });

        Schema::table('acceptance_inspection_reports', function (Blueprint $table) {
            $table->dropForeign(['purchase_order_id']);
            $table->dropColumn('po_number');
        });

        DB::statement('ALTER TABLE acceptance_inspection_reports ALTER COLUMN purchase_order_id SET NOT NULL');

        Schema::table('acceptance_inspection_reports', function (Blueprint $table) {
            $table->foreign('purchase_order_id')->references('id')->on('purchase_orders');
        });
    }
};
