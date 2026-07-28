<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('delivery_receipts', function (Blueprint $table) {
            $table->string('supplier_reference_number', 100)->nullable()->after('delivery_date');
            $table->string('delivery_location')->nullable()->after('supplier_reference_number');
            $table->string('delivery_condition', 50)->nullable()->after('delivery_location');
        });
    }

    public function down(): void
    {
        Schema::table('delivery_receipts', function (Blueprint $table) {
            $table->dropColumn(['supplier_reference_number', 'delivery_location', 'delivery_condition']);
        });
    }
};
