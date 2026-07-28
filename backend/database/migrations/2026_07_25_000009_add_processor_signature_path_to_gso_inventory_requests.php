<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('gso_inventory_requests', function (Blueprint $table) {
            $table->string('processor_signature_path')->nullable()->after('processor_signature');
        });
    }

    public function down(): void
    {
        Schema::table('gso_inventory_requests', function (Blueprint $table) {
            $table->dropColumn('processor_signature_path');
        });
    }
};
