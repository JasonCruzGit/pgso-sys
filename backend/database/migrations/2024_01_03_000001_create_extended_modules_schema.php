<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Extend supplier tracking
        Schema::table('suppliers', function (Blueprint $table) {
            $table->decimal('performance_rating', 3, 2)->nullable()->after('is_active');
            $table->unsignedInteger('total_deliveries')->default(0)->after('performance_rating');
            $table->text('notes')->nullable()->after('total_deliveries');
        });

        DB::statement("ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS inventory_items_condition_check");
        DB::statement("ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_condition_check CHECK (condition IN ('excellent','good','fair','poor','damaged','unserviceable'))");

        DB::statement("ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_condition_check");
        DB::statement("ALTER TABLE assets ADD CONSTRAINT assets_condition_check CHECK (condition IN ('excellent','good','fair','poor','damaged','unserviceable'))");

        Schema::create('batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_item_id')->constrained('inventory_items');
            $table->string('batch_number', 50);
            $table->string('lot_number', 50)->nullable();
            $table->date('manufacturing_date')->nullable();
            $table->date('expiration_date')->nullable();
            $table->decimal('quantity', 12, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['inventory_item_id', 'batch_number']);
            $table->index('expiration_date');
        });

        Schema::create('stock_transactions', function (Blueprint $table) {
            $table->id();
            $table->string('transaction_number', 50)->unique();
            $table->enum('type', ['stock_in', 'stock_out']);
            $table->foreignId('inventory_item_id')->constrained('inventory_items');
            $table->foreignId('batch_id')->nullable()->constrained('batches')->nullOnDelete();
            $table->decimal('quantity', 12, 2);
            $table->decimal('unit_cost', 14, 2)->default(0);
            $table->foreignId('supplier_id')->nullable()->constrained('suppliers')->nullOnDelete();
            $table->string('delivery_receipt_number', 50)->nullable();
            $table->string('purchase_order_number', 50)->nullable();
            $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->foreignId('recipient_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('purpose')->nullable();
            $table->foreignId('approving_officer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('performed_by')->constrained('users');
            $table->foreignId('stock_receipt_id')->nullable()->constrained('stock_receipts')->nullOnDelete();
            $table->foreignId('issuance_request_id')->nullable()->constrained('issuance_requests')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['type', 'created_at']);
            $table->index('inventory_item_id');
        });

        Schema::create('inventory_adjustments', function (Blueprint $table) {
            $table->id();
            $table->string('adjustment_number', 50)->unique();
            $table->foreignId('inventory_item_id')->constrained('inventory_items');
            $table->enum('adjustment_type', ['increase', 'decrease', 'correction']);
            $table->decimal('quantity_before', 12, 2);
            $table->decimal('quantity_change', 12, 2);
            $table->decimal('quantity_after', 12, 2);
            $table->text('reason');
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->foreignId('adjusted_by')->constrained('users');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['status', 'created_at']);
        });

        Schema::create('inventory_reconciliations', function (Blueprint $table) {
            $table->id();
            $table->string('reconciliation_number', 50)->unique();
            $table->string('title');
            $table->enum('status', ['draft', 'in_progress', 'completed'])->default('draft');
            $table->foreignId('started_by')->constrained('users');
            $table->timestamp('completed_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('inventory_reconciliation_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_reconciliation_id')->constrained('inventory_reconciliations')->cascadeOnDelete();
            $table->foreignId('inventory_item_id')->constrained('inventory_items');
            $table->decimal('system_quantity', 12, 2);
            $table->decimal('physical_quantity', 12, 2)->nullable();
            $table->decimal('shortage', 12, 2)->nullable();
            $table->decimal('overage', 12, 2)->nullable();
            $table->decimal('variance', 12, 2)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('asset_assignments', function (Blueprint $table) {
            $table->id();
            $table->string('assignment_number', 50)->unique();
            $table->foreignId('asset_id')->constrained('assets');
            $table->foreignId('custodian_user_id')->constrained('users');
            $table->foreignId('department_id')->constrained('departments');
            $table->foreignId('assigned_by')->constrained('users');
            $table->date('assignment_date');
            $table->enum('document_type', ['par', 'ics'])->default('par');
            $table->string('acknowledgment_number', 50)->unique();
            $table->text('qr_verification_data')->nullable();
            $table->string('digital_signature_path')->nullable();
            $table->enum('status', ['active', 'returned', 'transferred'])->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['asset_id', 'status']);
            $table->index('custodian_user_id');
        });

        Schema::create('asset_transfers', function (Blueprint $table) {
            $table->id();
            $table->string('transfer_number', 50)->unique();
            $table->foreignId('asset_id')->constrained('assets');
            $table->foreignId('from_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('to_user_id')->constrained('users');
            $table->foreignId('from_department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->foreignId('to_department_id')->constrained('departments');
            $table->foreignId('transferred_by')->constrained('users');
            $table->date('transfer_date');
            $table->text('reason')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('borrowing_logs', function (Blueprint $table) {
            $table->id();
            $table->string('borrow_number', 50)->unique();
            $table->foreignId('asset_id')->constrained('assets');
            $table->foreignId('borrower_user_id')->constrained('users');
            $table->foreignId('department_id')->constrained('departments');
            $table->foreignId('authorized_by')->constrained('users');
            $table->date('borrow_date');
            $table->date('expected_return_date');
            $table->date('actual_return_date')->nullable();
            $table->enum('status', ['active', 'returned', 'overdue'])->default('active');
            $table->enum('condition_on_borrow', ['excellent', 'good', 'fair', 'poor', 'unserviceable'])->default('good');
            $table->enum('condition_on_return', ['excellent', 'good', 'fair', 'poor', 'unserviceable'])->nullable();
            $table->text('purpose')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['status', 'expected_return_date']);
        });

        Schema::create('inspections', function (Blueprint $table) {
            $table->id();
            $table->string('inspection_number', 50)->unique();
            $table->foreignId('asset_id')->nullable()->constrained('assets')->nullOnDelete();
            $table->foreignId('inventory_item_id')->nullable()->constrained('inventory_items')->nullOnDelete();
            $table->foreignId('inspector_id')->constrained('users');
            $table->date('scheduled_date');
            $table->date('completed_date')->nullable();
            $table->enum('condition', ['excellent', 'good', 'fair', 'poor', 'unserviceable'])->nullable();
            $table->text('findings')->nullable();
            $table->enum('status', ['scheduled', 'completed', 'cancelled'])->default('scheduled');
            $table->string('report_path')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['status', 'scheduled_date']);
        });

        Schema::create('maintenance_records', function (Blueprint $table) {
            $table->id();
            $table->string('maintenance_number', 50)->unique();
            $table->foreignId('asset_id')->constrained('assets');
            $table->enum('type', ['preventive', 'corrective'])->default('preventive');
            $table->date('scheduled_date')->nullable();
            $table->date('completed_date')->nullable();
            $table->string('service_provider')->nullable();
            $table->decimal('cost', 14, 2)->default(0);
            $table->text('description')->nullable();
            $table->string('document_path')->nullable();
            $table->foreignId('performed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('status', ['scheduled', 'in_progress', 'completed', 'cancelled'])->default('scheduled');
            $table->timestamps();
            $table->softDeletes();
            $table->index(['status', 'scheduled_date']);
        });

        Schema::create('repair_records', function (Blueprint $table) {
            $table->id();
            $table->string('repair_number', 50)->unique();
            $table->foreignId('asset_id')->constrained('assets');
            $table->string('service_provider')->nullable();
            $table->date('repair_date');
            $table->decimal('cost', 14, 2)->default(0);
            $table->text('description')->nullable();
            $table->string('report_path')->nullable();
            $table->foreignId('recorded_by')->constrained('users');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('disposal_records', function (Blueprint $table) {
            $table->id();
            $table->string('disposal_number', 50)->unique();
            $table->foreignId('asset_id')->nullable()->constrained('assets')->nullOnDelete();
            $table->foreignId('inventory_item_id')->nullable()->constrained('inventory_items')->nullOnDelete();
            $table->date('recommendation_date');
            $table->text('reason');
            $table->enum('status', ['recommended', 'approved', 'completed', 'rejected'])->default('recommended');
            $table->foreignId('recommended_by')->constrained('users');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->date('disposal_date')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('condemnation_records', function (Blueprint $table) {
            $table->id();
            $table->string('condemnation_number', 50)->unique();
            $table->foreignId('asset_id')->constrained('assets');
            $table->foreignId('inspection_id')->nullable()->constrained('inspections')->nullOnDelete();
            $table->text('findings');
            $table->enum('status', ['recommended', 'approved', 'rejected', 'completed'])->default('recommended');
            $table->foreignId('recommended_by')->constrained('users');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->date('approval_date')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('purchase_requests', function (Blueprint $table) {
            $table->id();
            $table->string('pr_number', 50)->unique();
            $table->foreignId('department_id')->constrained('departments');
            $table->foreignId('requested_by')->constrained('users');
            $table->string('title');
            $table->text('description')->nullable();
            $table->decimal('total_estimated_cost', 14, 2)->default(0);
            $table->enum('status', ['draft', 'submitted', 'approved', 'rejected', 'completed'])->default('draft');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('rejection_reason')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->string('attachment_path')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['status', 'department_id']);
        });

        Schema::create('purchase_request_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_request_id')->constrained('purchase_requests')->cascadeOnDelete();
            $table->foreignId('inventory_item_id')->nullable()->constrained('inventory_items')->nullOnDelete();
            $table->string('description');
            $table->decimal('quantity', 12, 2);
            $table->decimal('unit_cost', 14, 2);
            $table->timestamps();
        });

        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->id();
            $table->string('po_number', 50)->unique();
            $table->foreignId('purchase_request_id')->nullable()->constrained('purchase_requests')->nullOnDelete();
            $table->foreignId('supplier_id')->constrained('suppliers');
            $table->enum('status', ['draft', 'issued', 'partial', 'fulfilled', 'cancelled'])->default('draft');
            $table->decimal('total_amount', 14, 2)->default(0);
            $table->foreignId('issued_by')->nullable()->constrained('users')->nullOnDelete();
            $table->date('issued_date')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index('status');
        });

        Schema::create('purchase_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_order_id')->constrained('purchase_orders')->cascadeOnDelete();
            $table->foreignId('inventory_item_id')->nullable()->constrained('inventory_items')->nullOnDelete();
            $table->string('description');
            $table->decimal('quantity_ordered', 12, 2);
            $table->decimal('quantity_received', 12, 2)->default(0);
            $table->decimal('unit_cost', 14, 2);
            $table->timestamps();
        });

        Schema::create('delivery_receipts', function (Blueprint $table) {
            $table->id();
            $table->string('dr_number', 50)->unique();
            $table->foreignId('purchase_order_id')->constrained('purchase_orders');
            $table->foreignId('stock_receipt_id')->nullable()->constrained('stock_receipts')->nullOnDelete();
            $table->date('delivery_date');
            $table->foreignId('received_by')->constrained('users');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('budget_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('department_id')->constrained('departments');
            $table->string('fiscal_year', 9);
            $table->string('category')->nullable();
            $table->text('description')->nullable();
            $table->decimal('allocated_amount', 14, 2);
            $table->decimal('spent_amount', 14, 2)->default(0);
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['department_id', 'fiscal_year', 'category']);
        });

        Schema::table('stock_receipts', function (Blueprint $table) {
            $table->foreignId('purchase_order_id')->nullable()->after('purchase_order_number')->constrained('purchase_orders')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_allocations');
        Schema::dropIfExists('delivery_receipts');
        Schema::dropIfExists('purchase_order_items');
        Schema::dropIfExists('purchase_orders');
        Schema::dropIfExists('purchase_request_items');
        Schema::dropIfExists('purchase_requests');
        Schema::dropIfExists('condemnation_records');
        Schema::dropIfExists('disposal_records');
        Schema::dropIfExists('repair_records');
        Schema::dropIfExists('maintenance_records');
        Schema::dropIfExists('inspections');
        Schema::dropIfExists('borrowing_logs');
        Schema::dropIfExists('asset_transfers');
        Schema::dropIfExists('asset_assignments');
        Schema::dropIfExists('inventory_reconciliation_items');
        Schema::dropIfExists('inventory_reconciliations');
        Schema::dropIfExists('inventory_adjustments');
        Schema::dropIfExists('stock_transactions');
        Schema::dropIfExists('batches');

        Schema::table('stock_receipts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('purchase_order_id');
        });

        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropColumn(['performance_rating', 'total_deliveries', 'notes']);
        });
    }
};
