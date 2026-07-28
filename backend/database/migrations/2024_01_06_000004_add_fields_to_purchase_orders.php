<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->date('expected_delivery_date')->nullable()->after('total_amount');
            $table->string('delivery_location')->nullable()->after('expected_delivery_date');
            $table->string('payment_terms', 100)->nullable()->after('delivery_location');
            $table->string('contact_person')->nullable()->after('payment_terms');
        });

        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->string('unit_of_measure', 30)->nullable()->after('description');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->dropColumn('unit_of_measure');
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn(['expected_delivery_date', 'delivery_location', 'payment_terms', 'contact_person']);
        });
    }
};
