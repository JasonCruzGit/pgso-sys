<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AssetAssignment;
use App\Models\User;
use App\Services\ExportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class IndividualPropertyAccountabilityController extends Controller
{
    public function __construct(private ExportService $export) {}

    public function employees(Request $request): JsonResponse
    {
        $employees = User::query()
            ->with('department:id,name,code')
            ->withCount([
                'accountabilityAssignments as property_count' => function ($query) {
                    $query->whereIn('document_type', ['par', 'ics']);
                },
            ])
            ->where('is_active', true)
            ->when($request->search, function ($query, $search) {
                $query->where(function ($query) use ($search) {
                    $query->where('name', 'ilike', "%{$search}%")
                        ->orWhere('employee_id', 'ilike', "%{$search}%")
                        ->orWhere('email', 'ilike', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->paginate($request->integer('per_page', 50));

        return response()->json($employees);
    }

    public function show(User $user, Request $request): JsonResponse
    {
        $user->load(['department:id,name,code', 'role:id,name,slug']);
        $assignments = $this->getPropertyRows($user, $request);

        $active = $assignments->where('status', 'active')->values();
        $surrendered = $assignments->where('status', '!=', 'active')->values();

        return response()->json([
            'employee' => $this->formatEmployee($user),
            'summary' => $this->buildSummary($assignments),
            'properties' => $assignments->values(),
            'active_properties' => $active,
            'surrendered_properties' => $surrendered,
        ]);
    }

    public function exportPdf(User $user, Request $request)
    {
        $user->load(['department:id,name,code', 'role:id,name,slug']);
        $rows = $this->applyPropertyView($this->getPropertyRows($user, $request), $request->property_view);
        $employee = $this->formatEmployee($user);

        $properties = $rows->map(fn (array $row) => [
            'property_number' => $row['property_number'],
            'reference_number' => $row['reference_number'],
            'document_type' => $row['document_type'],
            'description' => $row['description'],
            'date_acquired' => $row['date_acquired']
                ? date('M-d-Y', strtotime($row['date_acquired']))
                : '—',
            'quantity' => $row['quantity'],
            'unit_of_measure' => $row['unit_of_measure'],
            'unit_value' => $row['unit_value'],
            'total_value' => $row['total_value'],
            'status' => $row['status'],
        ])->values()->all();

        $filename = 'IPA-'.($user->employee_id ?: $user->id);

        return $this->export->toPdf('reports.individual-property-accountability', [
            'republic' => 'Republic of the Philippines',
            'province' => 'Provincial Government of Palawan',
            'office' => 'Provincial General Services Office',
            'generatedAt' => now()->format('M d, Y h:i A'),
            'viewLabel' => ucfirst($request->input('property_view', 'all')),
            'employee' => [
                'employee_id' => $employee['employee_id'],
                'name' => $employee['name'],
                'designation' => $employee['designation'],
                'department' => $employee['department']['name'] ?? null,
            ],
            'summary' => $this->buildSummary($rows),
            'properties' => $properties,
            'footer' => 'PGP PGSO — Inventory Management System',
        ], $filename);
    }

    private function getPropertyRows(User $user, Request $request): Collection
    {
        return AssetAssignment::query()
            ->with([
                'asset.inventoryItem:id,name,item_code,property_number,unit_of_measure,unit_cost,brand,model,description,date_acquired,serial_number',
                'department:id,name,code',
                'assigner:id,name',
                'materialRelease:id,mr_number',
                'materialReleaseItem:id,quantity,serial_number,unit_cost,inventory_item_id',
                'materialReleaseItem.inventoryItem:id,name,item_code,property_number,unit_of_measure,unit_cost,brand,model,description,date_acquired,serial_number',
            ])
            ->where('custodian_user_id', $user->id)
            ->whereIn('document_type', ['par', 'ics'])
            ->when($request->property_no, function ($query, $value) {
                $query->where(function ($query) use ($value) {
                    $query->whereHas('asset', fn ($q) => $q->where('property_number', 'ilike', "%{$value}%"))
                        ->orWhereHas('asset.inventoryItem', fn ($q) => $q->where('property_number', 'ilike', "%{$value}%")
                            ->orWhere('item_code', 'ilike', "%{$value}%"));
                });
            })
            ->when($request->responsibility_center, function ($query, $value) {
                $query->where(function ($query) use ($value) {
                    $query->whereHas('department', fn ($q) => $q->where('name', 'ilike', "%{$value}%")
                        ->orWhere('code', 'ilike', "%{$value}%"))
                        ->orWhereHas('assigner', fn ($q) => $q->where('name', 'ilike', "%{$value}%"));
                });
            })
            ->when($request->document_type, fn ($query, $type) => $query->where('document_type', strtolower($type)))
            ->when($request->status, fn ($query, $status) => $query->where('status', strtolower($status)))
            ->when($request->reference_no, function ($query, $value) {
                $query->where(function ($query) use ($value) {
                    $query->where('acknowledgment_number', 'ilike', "%{$value}%")
                        ->orWhere('assignment_number', 'ilike', "%{$value}%")
                        ->orWhereHas('materialRelease', fn ($q) => $q->where('mr_number', 'ilike', "%{$value}%"));
                });
            })
            ->latest('assignment_date')
            ->latest('id')
            ->get()
            ->map(fn (AssetAssignment $assignment) => $this->formatPropertyRow($assignment));
    }

    private function applyPropertyView(Collection $rows, ?string $view): Collection
    {
        return match ($view) {
            'active' => $rows->where('status', 'active')->values(),
            'surrendered' => $rows->where('status', '!=', 'active')->values(),
            default => $rows->values(),
        };
    }

    private function formatEmployee(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'employee_id' => $user->employee_id,
            'email' => $user->email,
            'phone' => $user->phone,
            'designation' => $user->role?->name,
            'department' => $user->department,
        ];
    }

    private function buildSummary(Collection $rows): array
    {
        return [
            'total' => $rows->count(),
            'active' => $rows->where('status', 'active')->count(),
            'surrendered' => $rows->where('status', '!=', 'active')->count(),
            'total_value' => round($rows->sum('total_value'), 2),
        ];
    }

    private function formatPropertyRow(AssetAssignment $assignment): array
    {
        $item = $assignment->asset?->inventoryItem
            ?? $assignment->materialReleaseItem?->inventoryItem;
        $qty = (float) ($assignment->materialReleaseItem?->quantity ?? 1);
        $unitCost = (float) ($item?->unit_cost ?? $assignment->materialReleaseItem?->unit_cost ?? 0);
        $descriptionParts = array_filter([
            $item?->brand ? "Brand: {$item->brand}" : null,
            $item?->model ? "Model: {$item->model}" : null,
            $item?->description ?: $item?->name,
        ]);

        return [
            'id' => $assignment->id,
            'property_number' => $assignment->asset?->property_number
                ?? $item?->property_number
                ?? $item?->item_code
                ?? '—',
            'reference_number' => $assignment->acknowledgment_number ?? $assignment->assignment_number,
            'document_type' => strtoupper($assignment->document_type ?? ''),
            'description' => implode('; ', $descriptionParts) ?: ($item?->name ?? '—'),
            'date_acquired' => $item?->date_acquired?->format('Y-m-d')
                ?? $assignment->assignment_date?->format('Y-m-d'),
            'quantity' => $qty,
            'unit_of_measure' => $item?->unit_of_measure ?? 'unit',
            'unit_value' => $unitCost,
            'total_value' => round($qty * $unitCost, 2),
            'status' => $assignment->status,
            'responsibility_center' => $assignment->department?->name,
            'inspector' => $assignment->assigner?->name,
            'mr_reference' => $assignment->materialRelease?->mr_number,
            'assignment' => $assignment,
        ];
    }
}
