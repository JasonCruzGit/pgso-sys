<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GsoInventoryRequest;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class GsoInventoryRequestController extends Controller
{
    public function __construct(private AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $records = GsoInventoryRequest::with('preparer:id,name')
            ->when($request->status, fn ($q, $status) => $q->where('status', $status))
            ->when($request->search, function ($q, $search) {
                $q->where(function ($q) use ($search) {
                    $q->where('control_number', 'ilike', "%{$search}%")
                        ->orWhere('employee_name', 'ilike', "%{$search}%")
                        ->orWhere('office_name', 'ilike', "%{$search}%")
                        ->orWhere('requester_signature', 'ilike', "%{$search}%")
                        ->orWhere('contact_no', 'ilike', "%{$search}%")
                        ->orWhere('purpose', 'ilike', "%{$search}%")
                        ->orWhere('request_type', 'ilike', "%{$search}%");
                });
            })
            ->latest('requested_at')
            ->latest('id')
            ->paginate($request->integer('per_page', 20));

        return response()->json($records);
    }

    public function show(GsoInventoryRequest $gsoInventoryRequest): JsonResponse
    {
        return response()->json($gsoInventoryRequest->load('preparer:id,name'));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $data['control_number'] = $this->nextControlNumber();
        $data['prepared_by'] = auth('api')->id();
        $data['approved_name'] = $data['approved_name'] ?? 'MERCY M. BONTAO';
        $data['approved_position'] = $data['approved_position'] ?? 'Acting PGSO';

        if ($path = $this->storeSignatureFile($request)) {
            $data['processor_signature_path'] = $path;
        }

        $record = GsoInventoryRequest::create($data);

        $this->audit->log(
            'create',
            'gso_inventory_request',
            "Created GSO Inventory Request {$record->control_number}",
            newValues: $record->toArray(),
        );

        return response()->json($record->load('preparer:id,name'), 201);
    }

    public function update(Request $request, GsoInventoryRequest $gsoInventoryRequest): JsonResponse
    {
        $data = $this->validated($request, updating: true);

        if ($request->boolean('clear_processor_signature')) {
            $this->deleteSignatureFile($gsoInventoryRequest->processor_signature_path);
            $data['processor_signature_path'] = null;
        } elseif ($path = $this->storeSignatureFile($request)) {
            $this->deleteSignatureFile($gsoInventoryRequest->processor_signature_path);
            $data['processor_signature_path'] = $path;
        }

        $gsoInventoryRequest->update($data);

        $this->audit->log(
            'update',
            'gso_inventory_request',
            "Updated GSO Inventory Request {$gsoInventoryRequest->control_number}",
            newValues: $gsoInventoryRequest->fresh()->toArray(),
        );

        return response()->json($gsoInventoryRequest->load('preparer:id,name'));
    }

    public function destroy(GsoInventoryRequest $gsoInventoryRequest): JsonResponse
    {
        $controlNumber = $gsoInventoryRequest->control_number;
        $this->deleteSignatureFile($gsoInventoryRequest->processor_signature_path);
        $gsoInventoryRequest->delete();

        $this->audit->log(
            'delete',
            'gso_inventory_request',
            "Deleted GSO Inventory Request {$controlNumber}",
        );

        return response()->json(['message' => 'Record deleted.']);
    }

    public function processorSignature(GsoInventoryRequest $gsoInventoryRequest): StreamedResponse
    {
        $path = $gsoInventoryRequest->processor_signature_path;
        if (! $path || ! Storage::disk('local')->exists($path)) {
            abort(404);
        }

        return Storage::disk('local')->response($path);
    }

    private function storeSignatureFile(Request $request): ?string
    {
        if (! $request->hasFile('processor_signature_file')) {
            return null;
        }

        $request->validate([
            'processor_signature_file' => ['required', 'file', 'image', 'max:3072', 'mimes:png,jpg,jpeg,gif,webp'],
        ]);

        return $request->file('processor_signature_file')
            ->store('gso-inventory-request-signatures', 'local');
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

        $boolFields = ['par_is_new', 'par_is_transfer', 'ics_is_new', 'ics_is_transfer'];
        foreach ($boolFields as $field) {
            if ($request->has($field)) {
                $request->merge([$field => filter_var($request->input($field), FILTER_VALIDATE_BOOLEAN)]);
            }
        }

        $rules = [
            'requested_at' => ['nullable', 'date'],
            'employee_name' => ['nullable', 'string', 'max:255'],
            'office_name' => ['nullable', 'string', 'max:255'],
            'request_type' => ['nullable', 'string', Rule::in(GsoInventoryRequest::REQUEST_TYPES)],
            'par_is_new' => ['nullable', 'boolean'],
            'par_is_transfer' => ['nullable', 'boolean'],
            'ics_is_new' => ['nullable', 'boolean'],
            'ics_is_transfer' => ['nullable', 'boolean'],
            'ics_to_name' => ['nullable', 'string', 'max:255'],
            'ics_employee_signature' => ['nullable', 'string', 'max:255'],
            'ics_office' => ['nullable', 'string', 'max:255'],
            'ics_position' => ['nullable', 'string', 'max:255'],
            'ics_id_no' => ['nullable', 'string', 'max:120'],
            'horm_property_or_plate' => ['nullable', 'string', 'max:255'],
            'others_specify' => ['nullable', 'string', 'max:255'],
            'purpose' => ['nullable', 'string'],
            'requester_signature' => ['nullable', 'string', 'max:255'],
            'contact_no' => ['nullable', 'string', 'max:80'],
            'pgso_instruction' => ['nullable', 'string'],
            'remarks' => ['nullable', 'string'],
            'processor_signature' => ['nullable', 'string', 'max:255'],
            'approved_name' => ['nullable', 'string', 'max:255'],
            'approved_position' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'in:draft,finalized'],
            'clear_processor_signature' => ['nullable', 'boolean'],
        ];

        if (! $isDraft) {
            $rules['requested_at'] = [$required, 'date'];
            $rules['employee_name'] = [$required, 'string', 'max:255'];
            $rules['office_name'] = [$required, 'string', 'max:255'];
            $rules['request_type'] = [$required, 'string', Rule::in(GsoInventoryRequest::REQUEST_TYPES)];
            $rules['purpose'] = [$required, 'string'];
            $rules['requester_signature'] = [$required, 'string', 'max:255'];
            $rules['contact_no'] = [$required, 'string', 'max:80'];
        }

        $data = $request->validate($rules);
        unset($data['clear_processor_signature']);

        return $data;
    }

    private function nextControlNumber(): string
    {
        $year = now()->format('Y');
        $prefix = "GSO-CS-{$year}-";

        $latest = GsoInventoryRequest::query()
            ->where('control_number', 'like', "{$prefix}%")
            ->orderByDesc('control_number')
            ->value('control_number');

        $sequence = 1;
        if ($latest && preg_match('/GSO-CS-\d{4}-(\d+)$/', $latest, $matches)) {
            $sequence = ((int) $matches[1]) + 1;
        }

        return $prefix.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
    }
}
