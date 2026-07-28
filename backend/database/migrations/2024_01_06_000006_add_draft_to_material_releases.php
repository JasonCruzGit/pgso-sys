<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('material_releases')) {
            return;
        }

        DB::statement("ALTER TABLE material_releases ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'completed'");
        DB::statement('ALTER TABLE material_releases ADD COLUMN IF NOT EXISTS draft_items JSON NULL');

        DB::statement('ALTER TABLE material_releases DROP CONSTRAINT IF EXISTS material_releases_recipient_user_id_foreign');
        DB::statement('ALTER TABLE material_releases ALTER COLUMN recipient_user_id DROP NOT NULL');
        DB::statement('ALTER TABLE material_releases ADD CONSTRAINT material_releases_recipient_user_id_foreign FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE SET NULL');

        DB::statement('ALTER TABLE material_releases DROP CONSTRAINT IF EXISTS material_releases_department_id_foreign');
        DB::statement('ALTER TABLE material_releases ALTER COLUMN department_id DROP NOT NULL');
        DB::statement('ALTER TABLE material_releases ADD CONSTRAINT material_releases_department_id_foreign FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL');

        DB::statement('ALTER TABLE material_releases ALTER COLUMN purpose DROP NOT NULL');
        DB::statement('ALTER TABLE material_releases ALTER COLUMN release_date DROP NOT NULL');

        DB::statement('ALTER TABLE material_releases DROP CONSTRAINT IF EXISTS material_releases_released_by_foreign');
        DB::statement('ALTER TABLE material_releases ALTER COLUMN released_by DROP NOT NULL');
        DB::statement('ALTER TABLE material_releases ADD CONSTRAINT material_releases_released_by_foreign FOREIGN KEY (released_by) REFERENCES users(id) ON DELETE SET NULL');
    }

    public function down(): void
    {
        if (! Schema::hasTable('material_releases')) {
            return;
        }

        DB::statement("UPDATE material_releases SET purpose = 'Draft' WHERE purpose IS NULL");
        DB::statement('UPDATE material_releases SET release_date = NOW() WHERE release_date IS NULL');
        DB::statement('DELETE FROM material_releases WHERE status = \'draft\'');

        DB::statement('ALTER TABLE material_releases DROP COLUMN IF EXISTS draft_items');
        DB::statement('ALTER TABLE material_releases DROP COLUMN IF EXISTS status');
    }
};
