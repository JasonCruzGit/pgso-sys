<?php

namespace App\Services;

use App\Models\AcceptanceInspectionReport;
use App\Models\ReceivedItem;

class ReceivedItemSyncService
{
    public function syncFromReport(AcceptanceInspectionReport $report): int
    {
        if ($report->status !== 'completed') {
            ReceivedItem::where('acceptance_inspection_report_id', $report->id)->delete();

            return 0;
        }

        $report->loadMissing(['deliveryReceipt', 'purchaseOrder.supplier']);

        $dr = $report->deliveryReceipt;
        $supplier = $report->purchaseOrder?->supplier?->name
            ?? $dr?->draft_items['supplier_name'] ?? null;
        $storageLocation = $report->place_of_delivery
            ?? $dr?->delivery_location
            ?? 'PGSO Main Warehouse, Provincial Capitol, Puerto Princesa City, Palawan';

        ReceivedItem::where('acceptance_inspection_report_id', $report->id)->delete();

        $synced = 0;
        $lineNumber = 0;

        foreach ($report->items ?? [] as $item) {
            if (! is_array($item)) {
                continue;
            }

            if ($this->isSummaryRow($item)) {
                continue;
            }

            $description = trim((string) ($item['description'] ?? ''));
            if ($description === '') {
                continue;
            }

            $lineNumber++;
            $qtyAccepted = (float) ($item['quantity_accepted'] ?? $item['quantity_delivered'] ?? 0);
            $unitCost = (float) ($item['unit_cost'] ?? 0);

            ReceivedItem::create([
                'acceptance_inspection_report_id' => $report->id,
                'delivery_receipt_id' => $report->delivery_receipt_id,
                'air_number' => $report->air_number,
                'dr_number' => $dr?->dr_number,
                'po_number' => $report->po_number ?? $report->purchaseOrder?->po_number,
                'line_number' => $lineNumber,
                'description' => $description,
                'unit_of_measure' => $item['unit_of_measure'] ?? 'unit',
                'quantity_ordered' => (float) ($item['quantity_ordered'] ?? 0),
                'quantity_delivered' => (float) ($item['quantity_delivered'] ?? $qtyAccepted),
                'quantity_accepted' => $qtyAccepted,
                'quantity_on_hand' => $qtyAccepted,
                'unit_cost' => $unitCost,
                'total_cost' => round($qtyAccepted * $unitCost, 2),
                'supplier_name' => $supplier,
                'requisitioning_office' => $report->requisitioning_office,
                'storage_location' => $storageLocation,
                'acceptance_date' => $report->acceptance_date ?? $report->inspection_date,
                'remarks' => $item['remarks'] ?? null,
                'status' => $qtyAccepted > 0 ? 'available' : 'depleted',
            ]);

            $synced++;
        }

        return $synced;
    }

    public function syncAllCompletedReports(): int
    {
        $total = 0;

        AcceptanceInspectionReport::query()
            ->where('status', 'completed')
            ->orderBy('id')
            ->each(function (AcceptanceInspectionReport $report) use (&$total) {
                $total += $this->syncFromReport($report);
            });

        return $total;
    }

    private function isSummaryRow(array $item): bool
    {
        $unit = strtolower(trim((string) ($item['unit_of_measure'] ?? '')));
        $desc = trim((string) ($item['description'] ?? ''));

        if (preg_match('/^(abc|amount)\b/i', $unit)) {
            return true;
        }

        if (preg_match('/^(abc|amount)\b/i', $desc)) {
            return true;
        }

        if (preg_match('/^amount\b/i', $unit) && is_numeric(str_replace([',', ' '], '', $desc))) {
            return true;
        }

        if (preg_match('/^abc\b/i', $unit) && is_numeric(str_replace([',', ' '], '', $desc))) {
            return true;
        }

        return false;
    }
}
