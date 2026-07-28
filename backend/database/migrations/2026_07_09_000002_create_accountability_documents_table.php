<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accountability_documents', function (Blueprint $table) {
            $table->id();
            $table->string('acknowledgment_number', 50)->unique();
            $table->enum('document_type', ['par', 'ics']);
            $table->foreignId('custodian_user_id')->constrained('users');
            $table->foreignId('department_id')->constrained('departments');
            $table->foreignId('material_release_id')->nullable()->constrained('material_releases')->nullOnDelete();
            $table->date('assignment_date');
            $table->string('fund_code', 20)->default('100');
            $table->string('fund_name', 255)->default('GENERAL FUND');
            $table->string('obr_reference', 100)->nullable();
            $table->string('mr_reference', 100)->nullable();
            $table->foreignId('assigned_by')->constrained('users');
            $table->enum('status', ['active', 'closed'])->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['document_type', 'assignment_date']);
            $table->index(['material_release_id', 'document_type', 'custodian_user_id'], 'acct_docs_mr_type_custodian_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accountability_documents');
    }
};
