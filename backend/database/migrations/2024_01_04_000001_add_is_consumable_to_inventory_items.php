<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->boolean('is_consumable')->default(true)->after('is_asset');
            $table->index('is_consumable');
        });

        DB::table('inventory_items')->where('is_asset', true)->update(['is_consumable' => false]);

        DB::table('inventory_items')
            ->whereIn('category_id', function ($query) {
                $query->select('id')->from('categories')->whereIn('code', ['ICT', 'FUR', 'VEH', 'MNT']);
            })
            ->update(['is_consumable' => false]);
    }

    public function down(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->dropIndex(['is_consumable']);
            $table->dropColumn('is_consumable');
        });
    }
};
