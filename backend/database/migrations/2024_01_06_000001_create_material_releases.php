<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('material_releases', function (Blueprint $table) {
            $table->id();
            $table->string('mr_number', 50)->unique();
            $table->foreignId('recipient_user_id')->constrained('users');
            $table->foreignId('department_id')->constrained('departments');
            $table->text('purpose');
            $table->foreignId('released_by')->constrained('users');
            $table->timestamp('release_date')->useCurrent();
            $table->foreignId('issuance_request_id')->nullable()->constrained('issuance_requests')->nullOnDelete();
            $table->enum('source', ['direct', 'request'])->default('direct');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['release_date', 'department_id']);
            $table->index('recipient_user_id');
        });

        Schema::create('material_release_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('material_release_id')->constrained('material_releases')->cascadeOnDelete();
            $table->foreignId('inventory_item_id')->constrained('inventory_items');
            $table->decimal('quantity', 12, 2);
            $table->decimal('unit_cost', 14, 2)->default(0);
            $table->foreignId('stock_transaction_id')->nullable()->constrained('stock_transactions')->nullOnDelete();
            $table->timestamps();
        });

        Schema::table('issuance_requests', function (Blueprint $table) {
            $table->string('mr_number', 50)->nullable()->unique()->after('request_number');
        });
    }

    public function down(): void
    {
        Schema::table('issuance_requests', function (Blueprint $table) {
            $table->dropColumn('mr_number');
        });
        Schema::dropIfExists('material_release_items');
        Schema::dropIfExists('material_releases');
    }
};
