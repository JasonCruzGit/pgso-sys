<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tracked_documents', function (Blueprint $table) {
            $table->id();
            $table->string('reference_no', 60)->unique();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('direction', 20); // incoming, outgoing, routing, internal
            $table->string('document_type', 40)->default('letter');
            $table->string('file_type', 20)->default('pdf');
            $table->string('file_path')->nullable();
            $table->string('status', 20)->default('active'); // pending, active, completed, archived
            $table->string('sender_name')->nullable();
            $table->string('recipient_name')->nullable();
            $table->foreignId('responsible_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('received_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['direction', 'status']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tracked_documents');
    }
};
