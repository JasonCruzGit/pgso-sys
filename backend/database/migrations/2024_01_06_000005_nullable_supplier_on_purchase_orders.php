<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('purchase_orders')) {
            return;
        }

        DB::statement('ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_supplier_id_foreign');
        DB::statement('ALTER TABLE purchase_orders ALTER COLUMN supplier_id DROP NOT NULL');
        DB::statement('ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_supplier_id_foreign FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL');
    }

    public function down(): void
    {
        if (! Schema::hasTable('purchase_orders')) {
            return;
        }

        DB::statement('ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_supplier_id_foreign');
        DB::statement('UPDATE purchase_orders SET supplier_id = (SELECT id FROM suppliers ORDER BY id LIMIT 1) WHERE supplier_id IS NULL');
        DB::statement('ALTER TABLE purchase_orders ALTER COLUMN supplier_id SET NOT NULL');
        DB::statement('ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_supplier_id_foreign FOREIGN KEY (supplier_id) REFERENCES suppliers(id)');
    }
};
