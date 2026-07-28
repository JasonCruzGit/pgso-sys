<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_requests', function (Blueprint $table) {
            $table->date('date_needed')->nullable()->after('description');
            $table->string('mode_of_procurement', 100)->nullable()->after('date_needed');
            $table->foreignId('budget_allocation_id')->nullable()->after('mode_of_procurement')
                ->constrained('budget_allocations')->nullOnDelete();
        });

        Schema::table('purchase_request_items', function (Blueprint $table) {
            $table->string('unit_of_measure', 30)->nullable()->after('description');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_request_items', function (Blueprint $table) {
            $table->dropColumn('unit_of_measure');
        });

        Schema::table('purchase_requests', function (Blueprint $table) {
            $table->dropConstrainedForeignId('budget_allocation_id');
            $table->dropColumn(['date_needed', 'mode_of_procurement']);
        });
    }
};
