<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ReceivedItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReceivedItemController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $items = ReceivedItem::query()
            ->when($request->boolean('with_relations', true), fn ($q) => $q->with(['acceptanceInspectionReport', 'deliveryReceipt']))
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->air_number, fn ($q, $v) => $q->where('air_number', 'ilike', "%{$v}%"))
            ->when($request->filled('po_number_exact'), function ($q) use ($request) {
                $po = trim($request->input('po_number_exact', ''));
                if ($po === '' || $po === '(No PO)') {
                    $q->where(function ($inner) {
                        $inner->whereNull('po_number')->orWhere('po_number', '');
                    });
                } else {
                    $q->whereRaw('TRIM(po_number) = ?', [$po]);
                }
            })
            ->when($request->search, fn ($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('description', 'ilike', "%{$s}%")
                    ->orWhere('air_number', 'ilike', "%{$s}%")
                    ->orWhere('dr_number', 'ilike', "%{$s}%")
                    ->orWhere('po_number', 'ilike', "%{$s}%")
                    ->orWhere('supplier_name', 'ilike', "%{$s}%")
                    ->orWhere('requisitioning_office', 'ilike', "%{$s}%");
            }))
            ->orderBy('description')
            ->orderBy('line_number')
            ->paginate($request->integer('per_page', 25));

        return response()->json($items);
    }

    /**
     * All line items for one PO (Item Registry drill-down).
     */
    public function byPo(Request $request): JsonResponse
    {
        $data = $request->validate([
            'po_number' => ['required', 'string', 'max:255'],
            'status' => ['nullable', 'string', 'max:50'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ]);

        $po = trim($data['po_number']);
        $query = ReceivedItem::query()->orderBy('description')->orderBy('line_number');

        if ($po === '' || $po === '(No PO)') {
            $query->where(function ($inner) {
                $inner->whereNull('po_number')->orWhere('po_number', '');
            });
        } else {
            $query->whereRaw('TRIM(po_number) = ?', [$po]);
        }

        if (! empty($data['status'])) {
            $query->where('status', $data['status']);
        }

        $perPage = (int) ($data['per_page'] ?? 500);
        $items = $query->paginate($perPage);

        return response()->json($items);
    }

    /**
     * Paginated PO groups for Item Registry (item name + PO only at list level).
     */
    public function groups(Request $request): JsonResponse
    {
        $base = ReceivedItem::query()
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->search, fn ($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('description', 'ilike', "%{$s}%")
                    ->orWhere('air_number', 'ilike', "%{$s}%")
                    ->orWhere('dr_number', 'ilike', "%{$s}%")
                    ->orWhere('po_number', 'ilike', "%{$s}%")
                    ->orWhere('supplier_name', 'ilike', "%{$s}%")
                    ->orWhere('requisitioning_office', 'ilike', "%{$s}%");
            }));

        $grouped = (clone $base)
            ->select([
                DB::raw("COALESCE(NULLIF(TRIM(po_number), ''), '(No PO)') as po_number"),
                DB::raw('COUNT(*)::int as item_count'),
                DB::raw('COALESCE(SUM(quantity_on_hand), 0) as total_on_hand'),
                DB::raw('COALESCE(SUM(quantity_on_hand * unit_cost), 0) as total_value'),
                DB::raw('MAX(acceptance_date) as latest_acceptance_date'),
                DB::raw('MAX(id) as latest_id'),
            ])
            ->groupBy(DB::raw("COALESCE(NULLIF(TRIM(po_number), ''), '(No PO)')"))
            ->orderByDesc('latest_acceptance_date')
            ->orderByDesc('latest_id');

        $perPage = $request->integer('per_page', 25);
        $page = max(1, $request->integer('page', 1));
        $total = (int) (clone $base)
            ->select(DB::raw("COUNT(DISTINCT COALESCE(NULLIF(TRIM(po_number), ''), '(No PO)')) as aggregate"))
            ->value('aggregate');
        $lastPage = max(1, (int) ceil($total / max(1, $perPage)));
        $rows = $grouped->forPage($page, $perPage)->get();

        $poKeys = $rows->pluck('po_number')->all();
        $sampleNames = collect();
        if ($poKeys !== []) {
            $sampleNames = ReceivedItem::query()
                ->where(function ($q) use ($poKeys) {
                    foreach ($poKeys as $po) {
                        if ($po === '(No PO)') {
                            $q->orWhere(function ($inner) {
                                $inner->whereNull('po_number')->orWhere('po_number', '');
                            });
                        } else {
                            $q->orWhere('po_number', $po);
                        }
                    }
                })
                ->orderBy('description')
                ->get(['id', 'po_number', 'description'])
                ->groupBy(fn ($item) => trim((string) ($item->po_number ?? '')) !== '' ? $item->po_number : '(No PO)')
                ->map(function ($items) {
                    $names = $items->pluck('description')->unique()->values();

                    return [
                        'item_name' => $names->first() ?? '—',
                        'other_names' => $names->slice(1, 2)->values()->all(),
                        'unique_names' => $names->count(),
                    ];
                });
        }

        $data = $rows->map(function ($row) use ($sampleNames) {
            $meta = $sampleNames->get($row->po_number, [
                'item_name' => '—',
                'other_names' => [],
                'unique_names' => 0,
            ]);

            return [
                'po_number' => $row->po_number,
                'item_name' => $meta['item_name'],
                'other_names' => $meta['other_names'],
                'unique_names' => $meta['unique_names'],
                'item_count' => (int) $row->item_count,
                'total_on_hand' => (float) $row->total_on_hand,
                'total_value' => (float) $row->total_value,
                'latest_acceptance_date' => $row->latest_acceptance_date,
            ];
        })->values();

        return response()->json([
            'data' => $data,
            'current_page' => $page,
            'last_page' => $lastPage,
            'per_page' => $perPage,
            'total' => $total,
        ]);
    }

    public function show(ReceivedItem $receivedItem): JsonResponse
    {
        return response()->json($receivedItem->load(['acceptanceInspectionReport', 'deliveryReceipt']));
    }

    public function summary(): JsonResponse
    {
        return response()->json([
            'total_items' => ReceivedItem::count(),
            'total_on_hand' => (float) ReceivedItem::sum('quantity_on_hand'),
            'total_value' => (float) ReceivedItem::selectRaw('SUM(quantity_on_hand * unit_cost) as value')->value('value'),
            'air_count' => ReceivedItem::distinct('acceptance_inspection_report_id')->count('acceptance_inspection_report_id'),
        ]);
    }
}
