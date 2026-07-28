<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->string('brand', 100)->nullable()->after('serial_number');
            $table->string('model', 100)->nullable()->after('brand');
        });

        Schema::table('stock_receipt_items', function (Blueprint $table) {
            $table->string('brand', 100)->nullable()->after('unit_cost');
            $table->string('model', 100)->nullable()->after('brand');
            $table->string('serial_number', 100)->nullable()->after('model');
        });
    }

    public function down(): void
    {
        Schema::table('stock_receipt_items', function (Blueprint $table) {
            $table->dropColumn(['brand', 'model', 'serial_number']);
        });

        Schema::table('inventory_items', function (Blueprint $table) {
            $table->dropColumn(['brand', 'model']);
        });
    }
};
