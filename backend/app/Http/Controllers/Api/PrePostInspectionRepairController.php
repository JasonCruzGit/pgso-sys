<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PrePostInspectionRepair;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PrePostInspectionRepairController extends Controller
{
    public function __construct(private AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $records = PrePostInspectionRepair::with('preparer:id,name')
            ->when($request->search, function ($q, $search) {
                $q->where(function ($q) use ($search) {
                    $q->where('control_number', 'ilike', "%{$search}%")
                        ->orWhere('property_no', 'ilike', "%{$search}%")
                        ->orWhere('plate_no', 'ilike', "%{$search}%")
                        ->orWhere('requisitioner', 'ilike', "%{$search}%")
                        ->orWhere('office', 'ilike', "%{$search}%")
                        ->orWhere('brand', 'ilike', "%{$search}%")
                        ->orWhere('model', 'ilike', "%{$search}%");
                });
            })
            ->latest('form_date')
            ->latest('id')
            ->paginate($request->integer('per_page', 20));

        return response()->json($records);
    }

    public function show(PrePostInspectionRepair $prePostInspectionRepair): JsonResponse
    {
        return response()->json($prePostInspectionRepair->load('preparer:id,name'));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $data['control_number'] = $this->nextControlNumber();
        $data['prepared_by'] = auth('api')->id();
        $data['approved_name'] = $data['approved_name'] ?? 'MERCY M. BONTAO';
        $data['approved_position'] = $data['approved_position'] ?? 'Acting PGSO';

        if ($path = $this->storeSignatureFile($request)) {
            $data['requisitioner_signature_path'] = $path;
        }

        $record = PrePostInspectionRepair::create($data);

        $this->audit->log(
            'create',
            'pre_post_inspection_repair',
            "Created Pre & Post Inspection of Repair {$record->control_number}",
            newValues: $record->toArray(),
        );

        return response()->json($record->load('preparer:id,name'), 201);
    }

    public function update(Request $request, PrePostInspectionRepair $prePostInspectionRepair): JsonResponse
    {
        $data = $this->validated($request, updating: true);

        if ($request->boolean('clear_requisitioner_signature')) {
            $this->deleteSignatureFile($prePostInspectionRepair->requisitioner_signature_path);
            $data['requisitioner_signature_path'] = null;
        } elseif ($path = $this->storeSignatureFile($request)) {
            $this->deleteSignatureFile($prePostInspectionRepair->requisitioner_signature_path);
            $data['requisitioner_signature_path'] = $path;
        }

        $prePostInspectionRepair->update($data);

        $this->audit->log(
            'update',
            'pre_post_inspection_repair',
            "Updated Pre & Post Inspection of Repair {$prePostInspectionRepair->control_number}",
            newValues: $prePostInspectionRepair->fresh()->toArray(),
        );

        return response()->json($prePostInspectionRepair->load('preparer:id,name'));
    }

    public function destroy(PrePostInspectionRepair $prePostInspectionRepair): JsonResponse
    {
        $controlNumber = $prePostInspectionRepair->control_number;
        $this->deleteSignatureFile($prePostInspectionRepair->requisitioner_signature_path);
        $prePostInspectionRepair->delete();

        $this->audit->log(
            'delete',
            'pre_post_inspection_repair',
            "Deleted Pre & Post Inspection of Repair {$controlNumber}",
        );

        return response()->json(['message' => 'Record deleted.']);
    }

    public function requisitionerSignature(PrePostInspectionRepair $prePostInspectionRepair): StreamedResponse
    {
        $path = $prePostInspectionRepair->requisitioner_signature_path;
        if (! $path || ! Storage::disk('local')->exists($path)) {
            abort(404);
        }

        return Storage::disk('local')->response($path);
    }

    private function storeSignatureFile(Request $request): ?string
    {
        if (! $request->hasFile('requisitioner_signature_file')) {
            return null;
        }

        $request->validate([
            'requisitioner_signature_file' => ['required', 'file', 'image', 'max:3072', 'mimes:png,jpg,jpeg,gif,webp'],
        ]);

        return $request->file('requisitioner_signature_file')
            ->store('pre-post-inspection-signatures', 'local');
    }

    private function deleteSignatureFile(?string $path): void
    {
        if ($path && Storage::disk('local')->exists($path)) {
            Storage::disk('local')->delete($path);
        }
    }

    private function validated(Request $request, bool $updating = false): array
    {
        $isDraft = $request->input('status', 'finalized') === 'draft';
        $required = $updating ? 'sometimes' : 'required';

        foreach (['pre_inspection', 'post_inspection'] as $field) {
            if ($request->has($field)) {
                $request->merge([$field => filter_var($request->input($field), FILTER_VALIDATE_BOOLEAN)]);
            }
        }

        $rules = [
            'form_date' => ['nullable', 'date'],
            'pre_inspection' => ['nullable', 'boolean'],
            'pre_inspection_date' => ['nullable', 'date'],
            'post_inspection' => ['nullable', 'boolean'],
            'post_inspection_date' => ['nullable', 'date'],
            'equipment_category' => ['nullable', 'string', Rule::in(PrePostInspectionRepair::EQUIPMENT_CATEGORIES)],
            'equipment_category_notes' => ['nullable', 'string', 'max:255'],
            'property_no' => ['nullable', 'string', 'max:120'],
            'type' => ['nullable', 'string', 'max:120'],
            'brand' => ['nullable', 'string', 'max:120'],
            'model' => ['nullable', 'string', 'max:120'],
            'engine_no' => ['nullable', 'string', 'max:120'],
            'chassis_no' => ['nullable', 'string', 'max:120'],
            'serial_no' => ['nullable', 'string', 'max:120'],
            'plate_no' => ['nullable', 'string', 'max:80'],
            'date_of_acquisition' => ['nullable', 'date'],
            'date_of_last_repair' => ['nullable', 'date'],
            'location_of_eqpt' => ['nullable', 'string', 'max:255'],
            'date_of_request' => ['nullable', 'date'],
            'office' => ['nullable', 'string', 'max:255'],
            'requisitioner' => ['nullable', 'string', 'max:255'],
            'approved_name' => ['nullable', 'string', 'max:255'],
            'approved_position' => ['nullable', 'string', 'max:255'],
            'approval_date' => ['nullable', 'date'],
            'inspector_1' => ['nullable', 'string', 'max:255'],
            'inspector_2' => ['nullable', 'string', 'max:255'],
            'inspector_3' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'in:draft,finalized'],
            'clear_requisitioner_signature' => ['nullable', 'boolean'],
        ];

        if (! $isDraft) {
            $rules['form_date'] = [$required, 'date'];
            $rules['equipment_category'] = [$required, 'string', Rule::in(PrePostInspectionRepair::EQUIPMENT_CATEGORIES)];
            // Printed name still preferred; signature image can stand alone for drafts/finalize soft check on frontend
            $rules['requisitioner'] = ['nullable', 'string', 'max:255'];
        }

        $data = $request->validate($rules);
        unset($data['clear_requisitioner_signature']);

        return $data;
    }

    private function nextControlNumber(): string
    {
        $year = now()->format('Y');
        $prefix = "GSO3-{$year}-";

        $latest = PrePostInspectionRepair::query()
            ->where('control_number', 'like', "{$prefix}%")
            ->orderByDesc('control_number')
            ->value('control_number');

        $sequence = 1;
        if ($latest && preg_match('/GSO3-\d{4}-(\d+)$/', $latest, $matches)) {
            $sequence = ((int) $matches[1]) + 1;
        }

        return $prefix.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
    }
}
