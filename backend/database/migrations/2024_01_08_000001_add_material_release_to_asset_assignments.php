<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('asset_assignments', function (Blueprint $table) {
            $table->foreignId('material_release_id')->nullable()->after('asset_id')
                ->constrained('material_releases')->nullOnDelete();
            $table->foreignId('material_release_item_id')->nullable()->after('material_release_id')
                ->constrained('material_release_items')->nullOnDelete();
            $table->unique('material_release_item_id');
        });
    }

    public function down(): void
    {
        Schema::table('asset_assignments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('material_release_item_id');
            $table->dropConstrainedForeignId('material_release_id');
        });
    }
};
