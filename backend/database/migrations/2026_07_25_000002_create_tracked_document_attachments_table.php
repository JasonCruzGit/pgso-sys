<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tracked_document_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tracked_document_id')->constrained('tracked_documents')->cascadeOnDelete();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('file_name');
            $table->string('file_path');
            $table->string('mime_type', 120)->nullable();
            $table->unsignedBigInteger('file_size')->default(0);
            $table->timestamps();

            $table->index('tracked_document_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tracked_document_attachments');
    }
};
