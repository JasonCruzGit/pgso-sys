<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tracked_documents', function (Blueprint $table) {
            $table->string('document_no', 80)->nullable()->after('reference_no');
            $table->string('instruction_for')->nullable()->after('recipient_name');
            $table->text('instruction_task')->nullable()->after('instruction_for');
        });

        Schema::create('tracked_document_tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tracked_document_id')->constrained('tracked_documents')->cascadeOnDelete();
            $table->string('assigned_to')->nullable();
            $table->text('body');
            $table->string('received_by')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('tracked_document_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tracked_document_tasks');

        Schema::table('tracked_documents', function (Blueprint $table) {
            $table->dropColumn(['document_no', 'instruction_for', 'instruction_task']);
        });
    }
};
