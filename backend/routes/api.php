<?php

use App\Http\Controllers\Api\AiController;
use App\Http\Controllers\Api\AssetAssignmentController;
use App\Http\Controllers\Api\AssetController;
use App\Http\Controllers\Api\AssetTransferController;
use App\Http\Controllers\Api\AcceptanceInspectionReportController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BatchController;
use App\Http\Controllers\Api\BorrowingLogController;
use App\Http\Controllers\Api\BudgetAllocationController;
use App\Http\Controllers\Api\CommunicationController;
use App\Http\Controllers\Api\CondemnationRecordController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DeliveryReceiptController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\EmployeeMasterlistController;
use App\Http\Controllers\Api\DisposalRecordController;
use App\Http\Controllers\Api\IndividualPropertyAccountabilityController;
use App\Http\Controllers\Api\GsoInventoryRequestController;
use App\Http\Controllers\Api\InspectionController;
use App\Http\Controllers\Api\PrePostInspectionRepairController;
use App\Http\Controllers\Api\InventoryAdjustmentController;
use App\Http\Controllers\Api\InventoryAuditController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\InventoryReconciliationController;
use App\Http\Controllers\Api\IssuanceController;
use App\Http\Controllers\Api\MaintenanceRecordController;
use App\Http\Controllers\Api\MaterialReleaseController;
use App\Http\Controllers\Api\PropertyAccountabilityController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PurchaseOrderController;
use App\Http\Controllers\Api\PurchaseRequestController;
use App\Http\Controllers\Api\PoItemsController;
use App\Http\Controllers\Api\RealPropertyController;
use App\Http\Controllers\Api\ReceivedItemController;
use App\Http\Controllers\Api\RepairRecordController;
use App\Http\Controllers\Api\FleetBorrowerSlipController;
use App\Http\Controllers\Api\FleetGpsIngestController;
use App\Http\Controllers\Api\FleetScheduleController;
use App\Http\Controllers\Api\FleetVehicleController;
use App\Http\Controllers\Api\FleetDriverController;
use App\Http\Controllers\Api\TrackedDocumentController;
use App\Http\Controllers\Api\WasteManagementReceiptController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\StockReceiptController;
use App\Http\Controllers\Api\StockTransactionController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\TemporaryCertificateController;
use App\Http\Controllers\Api\SystemController;
use App\Http\Controllers\Api\TrackingController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:5,1');
    Route::post('register', [AuthController::class, 'register'])->middleware('throttle:3,1');
    Route::get('registration-departments', [AuthController::class, 'registrationDepartments']);
    Route::post('refresh', [AuthController::class, 'refresh'])->middleware('throttle:10,1');
});

Route::middleware('auth:api')->group(function () {
    Route::prefix('auth')->group(function () {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::get('me', [AuthController::class, 'me']);
        Route::post('change-password', [AuthController::class, 'changePassword']);
    });

    Route::get('dashboard', [DashboardController::class, 'index'])->middleware('permission:dashboard.view');
    Route::get('system/public-url', [SystemController::class, 'publicUrl']);

    Route::get('roles', [RoleController::class, 'index']);
    Route::apiResource('departments', DepartmentController::class)->only(['index', 'store', 'update']);
    Route::get('suppliers', [SupplierController::class, 'index']);
    Route::middleware('permission:suppliers.*,procurement.*,users.*')->group(function () {
        Route::post('suppliers', [SupplierController::class, 'store']);
        Route::put('suppliers/{supplier}', [SupplierController::class, 'update']);
    });

    Route::middleware('permission:users.*')->group(function () {
        Route::get('users/pending-registrations', [UserController::class, 'pendingRegistrations']);
        Route::post('users/{user}/approve-registration', [UserController::class, 'approveRegistration']);
        Route::post('users/{user}/reject-registration', [UserController::class, 'rejectRegistration']);
        Route::apiResource('users', UserController::class);
        Route::post('users/{user}/reset-password', [UserController::class, 'resetPassword']);
    });

    Route::prefix('communications')->middleware('permission:messaging.view,messaging.send,messaging.*')->group(function () {
        Route::get('summary', [CommunicationController::class, 'summary']);
        Route::get('unread-count', [CommunicationController::class, 'unreadCount']);
        Route::post('presence', [CommunicationController::class, 'updatePresence']);
        Route::get('users/search', [CommunicationController::class, 'searchUsers']);
        Route::get('search', [CommunicationController::class, 'searchMessages']);

        Route::get('conversations', [CommunicationController::class, 'indexConversations']);
        Route::post('conversations/direct', [CommunicationController::class, 'storeDirect'])->middleware('permission:messaging.send,messaging.*');
        Route::post('conversations/group', [CommunicationController::class, 'storeGroup'])->middleware('permission:messaging.send,messaging.*');
        Route::post('conversations/context', [CommunicationController::class, 'linkContext'])->middleware('permission:messaging.send,messaging.*');
        Route::get('conversations/{conversation}', [CommunicationController::class, 'showConversation']);
        Route::put('conversations/{conversation}', [CommunicationController::class, 'updateGroup'])->middleware('permission:messaging.send,messaging.*');
        Route::post('conversations/{conversation}/members', [CommunicationController::class, 'addMembers'])->middleware('permission:messaging.send,messaging.*');
        Route::delete('conversations/{conversation}/members/{userId}', [CommunicationController::class, 'removeMember'])->middleware('permission:messaging.send,messaging.*');
        Route::post('conversations/{conversation}/archive', [CommunicationController::class, 'archiveConversation']);
        Route::get('conversations/{conversation}/messages', [CommunicationController::class, 'listMessages']);
        Route::post('conversations/{conversation}/messages', [CommunicationController::class, 'sendMessage'])->middleware('permission:messaging.send,messaging.*')->middleware('throttle:60,1');
        Route::post('conversations/{conversation}/read', [CommunicationController::class, 'markRead']);
        Route::post('conversations/{conversation}/typing', [CommunicationController::class, 'typing'])->middleware('permission:messaging.send,messaging.*');

        Route::put('messages/{message}', [CommunicationController::class, 'editMessage'])->middleware('permission:messaging.send,messaging.*');
        Route::delete('messages/{message}', [CommunicationController::class, 'deleteMessage'])->middleware('permission:messaging.send,messaging.*');
        Route::post('messages/{message}/react', [CommunicationController::class, 'react'])->middleware('permission:messaging.send,messaging.*');
        Route::get('attachments/{attachment}/download', [CommunicationController::class, 'downloadAttachment']);

        Route::get('announcements', [CommunicationController::class, 'indexAnnouncements']);
        Route::post('announcements', [CommunicationController::class, 'storeAnnouncement'])->middleware('permission:messaging.*,users.*');
        Route::post('announcements/{announcement}/acknowledge', [CommunicationController::class, 'acknowledgeAnnouncement']);
    });

    Route::middleware('permission:categories.*')->group(function () {
        Route::apiResource('categories', CategoryController::class);
    });
    Route::get('categories', [CategoryController::class, 'index'])->middleware('permission:inventory.view,dashboard.view,requests.create');

    Route::get('inventory/catalog', [InventoryController::class, 'catalog'])->middleware('permission:requests.create,inventory.view');
    Route::get('inventory/catalog/{inventoryItem}', [InventoryController::class, 'catalogShow'])->middleware('permission:requests.create,inventory.view');
    Route::get('inventory', [InventoryController::class, 'index'])->middleware('permission:inventory.view');
    Route::get('inventory/scan/{identifier}', [InventoryController::class, 'scan']);
    Route::get('inventory/{inventoryItem}', [InventoryController::class, 'show'])->middleware('permission:inventory.view');
    Route::get('inventory/{inventoryItem}/photo', [InventoryController::class, 'photo'])->middleware('permission:inventory.view,requests.create');

    Route::get('tracking/po', [TrackingController::class, 'byPo'])
        ->middleware('permission:inventory.view,procurement.view,procurement.*,assets.view,property.view,property.*');
    Route::get('po-items', [PoItemsController::class, 'lookup'])
        ->middleware('permission:inventory.view,procurement.view,procurement.*,assets.view,property.view,property.*');

    Route::middleware('permission:inventory.*')->group(function () {
        Route::post('inventory', [InventoryController::class, 'store']);
        Route::put('inventory/{inventoryItem}', [InventoryController::class, 'update']);
        Route::patch('inventory/{inventoryItem}', [InventoryController::class, 'update']);
        Route::delete('inventory/{inventoryItem}', [InventoryController::class, 'destroy']);
        Route::post('inventory/{inventoryItem}/adjust', [InventoryController::class, 'adjust']);
    });

    Route::middleware('permission:receiving.*')->group(function () {
        Route::apiResource('stock-receipts', StockReceiptController::class)->only(['index', 'store', 'show']);
    });

    Route::get('issuance', [IssuanceController::class, 'index']);
    Route::post('issuance', [IssuanceController::class, 'store'])->middleware('permission:requests.create');
    Route::get('issuance/{issuanceRequest}', [IssuanceController::class, 'show']);
    Route::post('issuance/{issuanceRequest}/approve', [IssuanceController::class, 'approve'])->middleware('permission:requests.approve');
    Route::post('issuance/{issuanceRequest}/reject', [IssuanceController::class, 'reject'])->middleware('permission:requests.approve');
    Route::post('issuance/{issuanceRequest}/release', [IssuanceController::class, 'release'])->middleware('permission:requests.release');
    Route::post('issuance/{issuanceRequest}/issue', [IssuanceController::class, 'issue'])->middleware('permission:requests.release');

    Route::middleware('permission:requests.release,issuance.*')->prefix('material-releases')->group(function () {
        Route::get('/', [MaterialReleaseController::class, 'index']);
        Route::get('/employees', [MaterialReleaseController::class, 'employees']);
        Route::get('/pending-requests', [MaterialReleaseController::class, 'pendingRequests']);
        Route::get('/available-units', [MaterialReleaseController::class, 'availableUnits']);
        Route::post('/', [MaterialReleaseController::class, 'store']);
        Route::get('/{materialRelease}', [MaterialReleaseController::class, 'show']);
        Route::post('/from-request/{issuanceRequest}', [MaterialReleaseController::class, 'releaseFromRequest']);
    });

    Route::get('assets/released-items', [AssetController::class, 'releasedItems'])->middleware('permission:assets.view');
    Route::get('assets/released-items/{materialReleaseItem}', [AssetController::class, 'showReleasedItem'])->middleware('permission:assets.view');
    Route::get('assets/material-releases/{materialRelease}', [AssetController::class, 'showMaterialRelease'])->middleware('permission:assets.view');
    Route::get('assets/scan/{propertyNumber}', [AssetController::class, 'scan'])->middleware('permission:assets.view');
    Route::get('assets', [AssetController::class, 'index'])->middleware('permission:assets.view');
    Route::middleware('permission:assets.*')->group(function () {
        Route::apiResource('assets', AssetController::class)->only(['store', 'show', 'update']);
    });

    Route::middleware('permission:audits.*')->group(function () {
        Route::apiResource('inventory-audits', InventoryAuditController::class)->only(['index', 'store', 'show']);
        Route::post('inventory-audits/{inventoryAudit}/verify', [InventoryAuditController::class, 'verify']);
        Route::post('inventory-audits/{inventoryAudit}/complete', [InventoryAuditController::class, 'complete']);
        Route::get('inventory-audits/{inventoryAudit}/variance', [InventoryAuditController::class, 'varianceReport']);
    });

    Route::prefix('reports')->middleware('permission:reports.*')->group(function () {
        Route::get('current-inventory', [ReportController::class, 'currentInventory']);
        Route::get('stock-card/{inventoryItem}', [ReportController::class, 'stockCard']);
        Route::get('issuance', [ReportController::class, 'issuanceReport']);
        Route::get('asset-registry', [ReportController::class, 'assetRegistry']);
        Route::get('disposal', [ReportController::class, 'disposalReport']);
        Route::get('stock-in', [ReportController::class, 'stockInReport']);
        Route::get('stock-out', [ReportController::class, 'stockOutReport']);
        Route::get('reconciliation', [ReportController::class, 'reconciliationReport']);
        Route::get('asset-assignments', [ReportController::class, 'assetAssignmentReport']);
        Route::get('par/{assetAssignment}', [ReportController::class, 'parReport']);
        Route::get('ics/{assetAssignment}', [ReportController::class, 'icsReport']);
        Route::get('maintenance', [ReportController::class, 'maintenanceReport']);
        Route::get('repairs', [ReportController::class, 'repairReport']);
        Route::get('inspections', [ReportController::class, 'inspectionReport']);
        Route::get('procurement-status', [ReportController::class, 'procurementStatusReport']);
        Route::get('suppliers', [ReportController::class, 'supplierReport']);
        Route::get('budget-utilization', [ReportController::class, 'budgetUtilizationReport']);
    });

    Route::middleware('permission:stock.view,stock.*')->group(function () {
        Route::get('stock-transactions', [StockTransactionController::class, 'index']);
        Route::get('inventory-adjustments', [InventoryAdjustmentController::class, 'index']);
        Route::get('inventory-reconciliations', [InventoryReconciliationController::class, 'index']);
        Route::get('inventory-reconciliations/{inventoryReconciliation}', [InventoryReconciliationController::class, 'show']);
        Route::get('batches', [BatchController::class, 'index']);
        Route::get('batches/{batch}', [BatchController::class, 'show']);
        Route::get('replenishment-recommendations', [StockTransactionController::class, 'replenishmentRecommendations']);
    });

    Route::middleware('permission:stock.*')->group(function () {
        Route::post('stock-transactions/stock-in', [StockTransactionController::class, 'storeStockIn']);
        Route::post('stock-transactions/stock-out', [StockTransactionController::class, 'storeStockOut']);
        Route::post('inventory-adjustments', [InventoryAdjustmentController::class, 'store']);
        Route::post('inventory-adjustments/{inventoryAdjustment}/approve', [InventoryAdjustmentController::class, 'approve']);
        Route::post('inventory-adjustments/{inventoryAdjustment}/reject', [InventoryAdjustmentController::class, 'reject']);
        Route::post('inventory-reconciliations', [InventoryReconciliationController::class, 'store']);
        Route::post('inventory-reconciliations/{inventoryReconciliation}/record-counts', [InventoryReconciliationController::class, 'recordCounts']);
        Route::post('inventory-reconciliations/{inventoryReconciliation}/complete', [InventoryReconciliationController::class, 'complete']);
        Route::post('batches', [BatchController::class, 'store']);
        Route::put('batches/{batch}', [BatchController::class, 'update']);
    });

    Route::middleware('permission:requests.release,issuance.*,property.view,property.*')->group(function () {
        Route::get('masterlist', [EmployeeMasterlistController::class, 'index']);
    });

    Route::middleware('permission:requests.release,issuance.*,property.view,property.*')->prefix('property-accountability')->group(function () {
        Route::get('/documents', [PropertyAccountabilityController::class, 'documentsIndex']);
        Route::get('/documents/{accountabilityDocument}', [PropertyAccountabilityController::class, 'documentsShow']);
        Route::get('/', [PropertyAccountabilityController::class, 'index']);
        Route::get('/pending', [PropertyAccountabilityController::class, 'pending']);
        Route::get('/assignable-assets', [PropertyAccountabilityController::class, 'assignableAssets']);
        Route::get('/{assetAssignment}', [PropertyAccountabilityController::class, 'show']);
        Route::post('/', [PropertyAccountabilityController::class, 'store'])
            ->middleware('permission:requests.release,issuance.*,property.*');
        Route::post('/from-mr-item/{materialReleaseItem}', [PropertyAccountabilityController::class, 'storeFromMrItem'])
            ->middleware('permission:requests.release,issuance.*,property.*');
    });

    Route::middleware('permission:property.view,property.*')->prefix('individual-property-accountability')->group(function () {
        Route::get('employees', [IndividualPropertyAccountabilityController::class, 'employees']);
        Route::get('employees/{user}', [IndividualPropertyAccountabilityController::class, 'show']);
        Route::get('employees/{user}/export/pdf', [IndividualPropertyAccountabilityController::class, 'exportPdf']);
    });

    Route::middleware('permission:property.view,property.*')->group(function () {
        Route::get('temporary-certificates', [TemporaryCertificateController::class, 'index']);
        Route::get('temporary-certificates/{temporaryCertificate}', [TemporaryCertificateController::class, 'show']);
    });

    Route::middleware('permission:property.*')->group(function () {
        Route::post('temporary-certificates', [TemporaryCertificateController::class, 'store']);
        Route::put('temporary-certificates/{temporaryCertificate}', [TemporaryCertificateController::class, 'update']);
        Route::delete('temporary-certificates/{temporaryCertificate}', [TemporaryCertificateController::class, 'destroy']);
    });

    Route::middleware('permission:property.view,property.*')->group(function () {
        Route::get('real-properties', [RealPropertyController::class, 'index']);
        Route::get('real-properties/{realProperty}', [RealPropertyController::class, 'show']);
    });

    Route::middleware('permission:property.*')->group(function () {
        Route::post('real-properties', [RealPropertyController::class, 'store']);
        Route::put('real-properties/{realProperty}', [RealPropertyController::class, 'update']);
        Route::delete('real-properties/{realProperty}', [RealPropertyController::class, 'destroy']);
    });

    Route::middleware('permission:property.view,property.*')->group(function () {
        Route::get('custodians', [AssetAssignmentController::class, 'custodians']);
        Route::get('asset-assignments', [AssetAssignmentController::class, 'index']);
        Route::get('asset-assignments/{assetAssignment}', [AssetAssignmentController::class, 'show']);
        Route::get('asset-transfers', [AssetTransferController::class, 'index']);
        Route::get('asset-transfers/{assetTransfer}', [AssetTransferController::class, 'show']);
        Route::get('borrowing-logs', [BorrowingLogController::class, 'index']);
        Route::get('employees/{user}/accountability', [AssetAssignmentController::class, 'employeeAccountability']);
    });

    Route::middleware('permission:property.*')->group(function () {
        Route::post('asset-assignments', [AssetAssignmentController::class, 'store']);
        Route::post('asset-assignments/{assetAssignment}/return', [AssetAssignmentController::class, 'returnAsset']);
        Route::post('asset-transfers', [AssetTransferController::class, 'store']);
        Route::post('borrowing-logs', [BorrowingLogController::class, 'store']);
        Route::post('borrowing-logs/{borrowingLog}/return', [BorrowingLogController::class, 'returnBorrow']);
    });

    Route::middleware('permission:inspection.view,inspection.*')->group(function () {
        Route::get('inspections', [InspectionController::class, 'index']);
        Route::get('inspections/{inspection}', [InspectionController::class, 'show']);
        Route::get('maintenance-records', [MaintenanceRecordController::class, 'index']);
        Route::get('maintenance-records/{maintenanceRecord}', [MaintenanceRecordController::class, 'show']);
        Route::get('repair-records', [RepairRecordController::class, 'index']);
        Route::get('repair-records/{repairRecord}', [RepairRecordController::class, 'show']);
        Route::get('disposal-records', [DisposalRecordController::class, 'index']);
        Route::get('condemnation-records', [CondemnationRecordController::class, 'index']);
        Route::get('pre-post-inspection-repairs', [PrePostInspectionRepairController::class, 'index']);
        Route::get('pre-post-inspection-repairs/{prePostInspectionRepair}', [PrePostInspectionRepairController::class, 'show']);
        Route::get('pre-post-inspection-repairs/{prePostInspectionRepair}/requisitioner-signature', [PrePostInspectionRepairController::class, 'requisitionerSignature']);
    });

    Route::middleware('permission:requests.create,requests.*,inspection.view,inspection.*,documents.view,documents.*,documents.incoming,documents.outgoing')->group(function () {
        Route::get('gso-inventory-requests', [GsoInventoryRequestController::class, 'index']);
        Route::get('gso-inventory-requests/{gsoInventoryRequest}', [GsoInventoryRequestController::class, 'show']);
        Route::get('gso-inventory-requests/{gsoInventoryRequest}/processor-signature', [GsoInventoryRequestController::class, 'processorSignature']);
        Route::post('gso-inventory-requests', [GsoInventoryRequestController::class, 'store']);
        Route::put('gso-inventory-requests/{gsoInventoryRequest}', [GsoInventoryRequestController::class, 'update']);
        Route::post('gso-inventory-requests/{gsoInventoryRequest}', [GsoInventoryRequestController::class, 'update']);
        Route::delete('gso-inventory-requests/{gsoInventoryRequest}', [GsoInventoryRequestController::class, 'destroy']);
    });

    Route::middleware('permission:inspection.*')->group(function () {
        Route::post('inspections', [InspectionController::class, 'store']);
        Route::post('inspections/{inspection}/complete', [InspectionController::class, 'complete']);
        Route::post('maintenance-records', [MaintenanceRecordController::class, 'store']);
        Route::post('maintenance-records/{maintenanceRecord}/complete', [MaintenanceRecordController::class, 'complete']);
        Route::post('repair-records', [RepairRecordController::class, 'store']);
        Route::post('disposal-records', [DisposalRecordController::class, 'store']);
        Route::post('disposal-records/{disposalRecord}/approve', [DisposalRecordController::class, 'approve']);
        Route::post('disposal-records/{disposalRecord}/complete', [DisposalRecordController::class, 'complete']);
        Route::post('condemnation-records', [CondemnationRecordController::class, 'store']);
        Route::post('condemnation-records/{condemnationRecord}/approve', [CondemnationRecordController::class, 'approve']);
        Route::post('pre-post-inspection-repairs', [PrePostInspectionRepairController::class, 'store']);
        Route::put('pre-post-inspection-repairs/{prePostInspectionRepair}', [PrePostInspectionRepairController::class, 'update']);
        Route::post('pre-post-inspection-repairs/{prePostInspectionRepair}', [PrePostInspectionRepairController::class, 'update']);
        Route::delete('pre-post-inspection-repairs/{prePostInspectionRepair}', [PrePostInspectionRepairController::class, 'destroy']);
    });

    Route::middleware('permission:procurement.view,procurement.*,procurement.create,procurement.view_own')->group(function () {
        Route::get('purchase-requests', [PurchaseRequestController::class, 'index']);
        Route::get('purchase-requests/{purchaseRequest}', [PurchaseRequestController::class, 'show']);
        Route::get('purchase-orders', [PurchaseOrderController::class, 'index']);
        Route::get('purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'show']);
        Route::get('delivery-receipts', [DeliveryReceiptController::class, 'index']);
        Route::get('delivery-receipts/{deliveryReceipt}', [DeliveryReceiptController::class, 'show']);
        Route::get('acceptance-inspection-reports', [AcceptanceInspectionReportController::class, 'index']);
        Route::get('acceptance-inspection-reports/pending-delivery-receipts', [AcceptanceInspectionReportController::class, 'pendingDeliveryReceipts']);
        Route::get('acceptance-inspection-reports/{acceptanceInspectionReport}', [AcceptanceInspectionReportController::class, 'show']);
        Route::get('received-items', [ReceivedItemController::class, 'index']);
        Route::get('received-items/summary', [ReceivedItemController::class, 'summary']);
        Route::get('received-items/groups', [ReceivedItemController::class, 'groups']);
        Route::get('received-items/by-po', [ReceivedItemController::class, 'byPo']);
        Route::get('received-items/{receivedItem}', [ReceivedItemController::class, 'show']);
        Route::get('waste-management-receipts', [WasteManagementReceiptController::class, 'index']);
        Route::get('waste-management-receipts/{wasteManagementReceipt}', [WasteManagementReceiptController::class, 'show']);
    });

    Route::middleware('permission:procurement.create,procurement.*')->group(function () {
        Route::post('purchase-requests', [PurchaseRequestController::class, 'store']);
        Route::post('purchase-requests/{purchaseRequest}/submit', [PurchaseRequestController::class, 'submit']);
    });

    Route::middleware('permission:procurement.*')->group(function () {
        Route::post('purchase-requests/{purchaseRequest}/approve', [PurchaseRequestController::class, 'approve']);
        Route::post('purchase-requests/{purchaseRequest}/reject', [PurchaseRequestController::class, 'reject']);
        Route::post('purchase-orders', [PurchaseOrderController::class, 'store']);
        Route::post('purchase-orders/{purchaseOrder}/issue', [PurchaseOrderController::class, 'issue']);
        Route::post('delivery-receipts', [DeliveryReceiptController::class, 'store']);
        Route::post('delivery-receipts/import', [DeliveryReceiptController::class, 'importSpreadsheet']);
        Route::put('delivery-receipts/{deliveryReceipt}', [DeliveryReceiptController::class, 'update']);
        Route::post('delivery-receipts/{deliveryReceipt}/finalize', [DeliveryReceiptController::class, 'finalize']);
        Route::post('acceptance-inspection-reports', [AcceptanceInspectionReportController::class, 'store']);
        Route::put('acceptance-inspection-reports/{acceptanceInspectionReport}', [AcceptanceInspectionReportController::class, 'update']);
        Route::post('acceptance-inspection-reports/{acceptanceInspectionReport}/finalize', [AcceptanceInspectionReportController::class, 'finalize']);
        Route::post('waste-management-receipts', [WasteManagementReceiptController::class, 'store']);
    });

    Route::middleware('permission:budget.view,budget.*')->group(function () {
        Route::get('budget-allocations', [BudgetAllocationController::class, 'index']);
        Route::get('budget-allocations/{budgetAllocation}', [BudgetAllocationController::class, 'show']);
    });

    Route::middleware('permission:budget.*')->group(function () {
        Route::post('budget-allocations', [BudgetAllocationController::class, 'store']);
        Route::put('budget-allocations/{budgetAllocation}', [BudgetAllocationController::class, 'update']);
    });

    Route::middleware('permission:audit_logs.view')->group(function () {
        Route::get('audit-logs', [AuditLogController::class, 'index']);
        Route::get('audit-logs/{auditLog}', [AuditLogController::class, 'show']);
    });

    Route::prefix('notifications')->group(function () {
        Route::get('/', [NotificationController::class, 'index']);
        Route::get('/unread-count', [NotificationController::class, 'unreadCount']);
        Route::post('/mark-all-read', [NotificationController::class, 'markAllRead']);
        Route::post('/{notification}/read', [NotificationController::class, 'markRead']);
    });

    Route::prefix('ai')->group(function () {
        Route::middleware('permission:ai.chat,ai.*')->group(function () {
            Route::post('chat', [AiController::class, 'chat'])->middleware('throttle:20,1');
            Route::get('conversations', [AiController::class, 'conversations']);
            Route::get('conversations/{conversation}', [AiController::class, 'showConversation']);
            Route::delete('conversations/{conversation}', [AiController::class, 'destroyConversation']);
            Route::get('suggested-questions', [AiController::class, 'suggestedQuestions']);
        });

        Route::middleware('permission:ai.view,ai.analytics,ai.*')->group(function () {
            Route::get('status', [AiController::class, 'status']);
            Route::get('analytics', [AiController::class, 'analytics'])->middleware('throttle:60,1');
            Route::get('forecast', [AiController::class, 'forecast'])->middleware('throttle:30,1');
            Route::get('recommendations', [AiController::class, 'recommendations'])->middleware('throttle:30,1');
            Route::get('executive-summary', [AiController::class, 'executiveSummary'])->middleware('throttle:30,1');
        });

        Route::middleware('permission:ai.reports,reports.*,ai.*')->group(function () {
            Route::get('compliance-report', [AiController::class, 'complianceReport'])->middleware('throttle:20,1');
        });
    });

    // Fleet Management — GPS Tracking & Vehicle Scheduling
    Route::prefix('fleet')->group(function () {
        Route::middleware('permission:fleet.view,fleet.gps,fleet.*')->group(function () {
            Route::get('dashboard', [FleetVehicleController::class, 'dashboard']);
            Route::get('vehicles/live', [FleetVehicleController::class, 'liveMap']);
            Route::get('vehicles', [FleetVehicleController::class, 'index']);
            Route::get('vehicles/{fleetVehicle}', [FleetVehicleController::class, 'show']);
            Route::get('vehicles/{fleetVehicle}/route-history', [FleetVehicleController::class, 'routeHistory']);
            Route::get('drivers', [FleetDriverController::class, 'index']);
        });

        Route::middleware('permission:fleet.*,fleet.manage')->group(function () {
            Route::post('vehicles', [FleetVehicleController::class, 'store']);
            Route::put('vehicles/{fleetVehicle}', [FleetVehicleController::class, 'update']);
            Route::delete('vehicles/{fleetVehicle}', [FleetVehicleController::class, 'destroy']);
            Route::put('drivers/{user}', [FleetDriverController::class, 'update']);
            Route::post('gps/simulate', [FleetGpsIngestController::class, 'simulate']);
        });

        Route::middleware('permission:fleet.view,fleet.schedule,fleet.*')->group(function () {
            Route::get('schedules', [FleetScheduleController::class, 'index']);
            Route::get('schedules/calendar', [FleetScheduleController::class, 'calendar']);
            Route::get('schedules/{fleetSchedule}', [FleetScheduleController::class, 'show']);
            Route::post('schedules/check-conflicts', [FleetScheduleController::class, 'checkConflicts']);
        });

        Route::middleware('permission:fleet.schedule,fleet.*')->group(function () {
            Route::post('borrower-slips', [FleetBorrowerSlipController::class, 'store']);
            Route::get('borrower-slips/{fleetBorrowerSlip}', [FleetBorrowerSlipController::class, 'show']);
            Route::get('borrower-slips/{fleetBorrowerSlip}/pdf', [FleetBorrowerSlipController::class, 'pdf']);
            Route::post('schedules', [FleetScheduleController::class, 'store']);
            Route::put('schedules/{fleetSchedule}', [FleetScheduleController::class, 'update']);
            Route::post('schedules/{fleetSchedule}/cancel', [FleetScheduleController::class, 'cancel']);
            Route::post('schedules/{fleetSchedule}/start', [FleetScheduleController::class, 'start']);
            Route::post('schedules/{fleetSchedule}/complete', [FleetScheduleController::class, 'complete']);
        });

        Route::middleware('permission:fleet.approve,fleet.*')->group(function () {
            Route::post('schedules/{fleetSchedule}/approve', [FleetScheduleController::class, 'approve']);
            Route::post('schedules/{fleetSchedule}/reject', [FleetScheduleController::class, 'reject']);
        });

        Route::middleware('permission:fleet.reports,fleet.view,fleet.*,reports.*')->group(function () {
            Route::get('reports', [FleetScheduleController::class, 'reports']);
        });

        Route::middleware('permission:fleet.*,fleet.gps')->group(function () {
            Route::post('gps/ingest/{provider?}', [FleetGpsIngestController::class, 'webhook']);
        });
    });

    Route::prefix('documents')->group(function () {
        Route::middleware('permission:documents.view,documents.*,documents.incoming,documents.outgoing,documents.routing,documents.records')->group(function () {
            Route::get('/', [TrackedDocumentController::class, 'index']);
            Route::get('report', [TrackedDocumentController::class, 'report']);
            Route::post('report/pdf', [TrackedDocumentController::class, 'exportPdf']);
            Route::get('{trackedDocument}', [TrackedDocumentController::class, 'show']);
            Route::get('{trackedDocument}/attachments/{attachment}/download', [TrackedDocumentController::class, 'downloadAttachment']);
        });

        Route::middleware('permission:documents.*,documents.incoming,documents.outgoing,documents.routing,documents.records')->group(function () {
            Route::post('/', [TrackedDocumentController::class, 'store']);
            Route::put('{trackedDocument}', [TrackedDocumentController::class, 'update']);
            Route::post('{trackedDocument}/tasks', [TrackedDocumentController::class, 'storeTask']);
            Route::post('{trackedDocument}/attachments', [TrackedDocumentController::class, 'storeAttachment']);
            Route::delete('{trackedDocument}/attachments/{attachment}', [TrackedDocumentController::class, 'destroyAttachment']);
            Route::delete('{trackedDocument}', [TrackedDocumentController::class, 'destroy']);
        });
    });
});
