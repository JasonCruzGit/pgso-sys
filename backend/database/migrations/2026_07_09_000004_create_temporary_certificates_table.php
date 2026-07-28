<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('temporary_certificates', function (Blueprint $table) {
            $table->id();
            $table->string('control_number', 20)->unique();
            $table->date('request_date');
            $table->string('requester_name');
            $table->string('requester_position')->nullable();
            $table->string('requester_office')->nullable();
            $table->string('recipient_name');
            $table->string('recipient_position')->nullable();
            $table->string('recipient_office')->nullable();
            $table->text('transfer_reason');
            $table->string('conformed_name')->nullable();
            $table->string('conformed_position')->nullable();
            $table->string('conformed_office')->nullable();
            $table->string('attested_name')->nullable();
            $table->string('attested_position')->nullable();
            $table->string('attested_office')->nullable();
            $table->string('approved_name')->nullable();
            $table->string('approved_position')->nullable();
            $table->foreignId('prepared_by')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('status', ['draft', 'finalized'])->default('draft');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('temporary_certificates');
    }
};
