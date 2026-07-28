<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_item_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_item_id')->constrained('inventory_items')->cascadeOnDelete();
            $table->foreignId('category_id')->constrained('categories')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['inventory_item_id', 'category_id']);
            $table->index('category_id');
        });

        $items = DB::table('inventory_items')->whereNotNull('category_id')->get(['id', 'category_id']);

        foreach ($items as $item) {
            DB::table('inventory_item_categories')->insert([
                'inventory_item_id' => $item->id,
                'category_id' => $item->category_id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_item_categories');
    }
};
