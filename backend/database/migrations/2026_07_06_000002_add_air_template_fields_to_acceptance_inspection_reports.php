<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('acceptance_inspection_reports', function (Blueprint $table) {
            $table->date('po_date')->nullable()->after('delivery_receipt_id');
            $table->string('invoice_number')->nullable()->after('po_date');
            $table->date('invoice_date')->nullable()->after('invoice_number');
            $table->string('requisitioning_office')->nullable()->after('invoice_date');
            $table->string('obligation_request_no')->nullable()->after('requisitioning_office');
            $table->decimal('abc_amount', 15, 2)->nullable()->after('remarks');
            $table->text('remarks_for_use_of')->nullable()->after('abc_amount');
            $table->boolean('acceptance_complete')->default(false)->after('remarks_for_use_of');
            $table->boolean('acceptance_partial')->default(false)->after('acceptance_complete');
            $table->boolean('acceptance_spec_accepted')->default(false)->after('acceptance_partial');
            $table->boolean('inspection_correct')->default(false)->after('acceptance_spec_accepted');
        });
    }

    public function down(): void
    {
        Schema::table('acceptance_inspection_reports', function (Blueprint $table) {
            $table->dropColumn([
                'po_date',
                'invoice_number',
                'invoice_date',
                'requisitioning_office',
                'obligation_request_no',
                'abc_amount',
                'remarks_for_use_of',
                'acceptance_complete',
                'acceptance_partial',
                'acceptance_spec_accepted',
                'inspection_correct',
            ]);
        });
    }
};
