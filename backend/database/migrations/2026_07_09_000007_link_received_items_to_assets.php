<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('received_items', function (Blueprint $table) {
            $table->foreignId('inventory_item_id')->nullable()->after('delivery_receipt_id')->constrained()->nullOnDelete();
            $table->foreignId('asset_id')->nullable()->after('inventory_item_id')->constrained()->nullOnDelete();
        });

        Schema::table('asset_assignments', function (Blueprint $table) {
            $table->foreignId('received_item_id')->nullable()->after('material_release_item_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('asset_assignments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('received_item_id');
        });

        Schema::table('received_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('asset_id');
            $table->dropConstrainedForeignId('inventory_item_id');
        });
    }
};
