<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('material_release_items', function (Blueprint $table) {
            $table->string('serial_number', 100)->nullable()->after('inventory_item_id');
        });
    }

    public function down(): void
    {
        Schema::table('material_release_items', function (Blueprint $table) {
            $table->dropColumn('serial_number');
        });
    }
};
