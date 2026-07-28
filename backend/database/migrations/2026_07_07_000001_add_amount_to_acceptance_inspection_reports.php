<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('acceptance_inspection_reports', function (Blueprint $table) {
            $table->decimal('amount', 15, 2)->nullable()->after('abc_amount');
        });
    }

    public function down(): void
    {
        Schema::table('acceptance_inspection_reports', function (Blueprint $table) {
            $table->dropColumn('amount');
        });
    }
};
