<?php

namespace App\Enums;

enum RoleSlug: string
{
    case Admin = 'system_administrator';
    case InventoryOfficer = 'gso_inventory_officer';
    case DepartmentUser = 'department_user';
    case Auditor = 'auditor';
    case FleetOfficer = 'fleet_officer';
    case DocumentTracking = 'document_tracking';
    case DocumentTrackingAdmin = 'document_tracking_admin';

    public function displayName(): string
    {
        return match ($this) {
            self::Admin => 'System Administrator',
            self::InventoryOfficer => 'GSO Inventory Officer',
            self::DepartmentUser => 'Department User',
            self::Auditor => 'Internal Auditor',
            self::FleetOfficer => 'Fleet Officer',
            self::DocumentTracking => 'Document Tracking',
            self::DocumentTrackingAdmin => 'Document Tracking/Admin',
        };
    }

    public function permissions(): array
    {
        return match ($this) {
            self::Admin => ['*'],
            self::InventoryOfficer => [
                'dashboard.view', 'inventory.*', 'categories.*', 'receiving.*',
                'issuance.*', 'assets.*', 'audits.*', 'reports.*', 'notifications.*',
                'requests.approve', 'requests.release',
                'stock.*', 'property.*', 'inspection.*', 'procurement.*', 'budget.*', 'suppliers.*',
                'ai.*', 'messaging.*',
            ],
            self::DepartmentUser => [
                'dashboard.view', 'requests.create', 'requests.view_own',
                'assets.view', 'notifications.view',
                'procurement.create', 'procurement.view_own', 'property.view',
                'ai.chat', 'ai.view',
                'messaging.view', 'messaging.send',
            ],
            self::Auditor => [
                'dashboard.view', 'inventory.view', 'assets.view', 'audits.view',
                'reports.*', 'audit_logs.view',
                'stock.view', 'property.view', 'inspection.view', 'procurement.view', 'budget.view',
                'ai.view', 'ai.analytics', 'ai.reports',
                'messaging.view',
            ],
            self::FleetOfficer => [
                'dashboard.view',
                'notifications.view',
                'messaging.view', 'messaging.send',
                'fleet.*',
            ],
            self::DocumentTracking => [
                'notifications.view',
                'messaging.view', 'messaging.send',
                'documents.view',
                'inspection.view',
                'inspection.*',
            ],
            self::DocumentTrackingAdmin => [
                'notifications.view',
                'messaging.view', 'messaging.send',
                'documents.view',
                'documents.incoming',
                'documents.outgoing',
                'inspection.view',
                'inspection.*',
            ],
        };
    }

    public function requiresTaskDivision(): bool
    {
        return $this === self::DocumentTracking;
    }

    public function isDocumentTrackingFamily(): bool
    {
        return $this === self::DocumentTracking || $this === self::DocumentTrackingAdmin;
    }
}
