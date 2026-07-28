<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pre_post_inspection_repairs', function (Blueprint $table) {
            $table->string('requisitioner_signature_path')->nullable()->after('requisitioner');
        });
    }

    public function down(): void
    {
        Schema::table('pre_post_inspection_repairs', function (Blueprint $table) {
            $table->dropColumn('requisitioner_signature_path');
        });
    }
};
