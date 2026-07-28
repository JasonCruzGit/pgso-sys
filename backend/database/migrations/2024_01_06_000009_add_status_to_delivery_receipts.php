<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('delivery_receipts', function (Blueprint $table) {
            $table->string('status', 20)->default('completed')->after('dr_number');
            $table->json('draft_items')->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('delivery_receipts', function (Blueprint $table) {
            $table->dropColumn(['status', 'draft_items']);
        });
    }
};
