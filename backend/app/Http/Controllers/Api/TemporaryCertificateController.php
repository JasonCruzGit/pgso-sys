<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TemporaryCertificate;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TemporaryCertificateController extends Controller
{
    public function __construct(private AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $certificates = TemporaryCertificate::with('preparer')
            ->when($request->search, fn ($q, $search) => $q->where(function ($q) use ($search) {
                $q->where('control_number', 'ilike', "%{$search}%")
                    ->orWhere('requester_name', 'ilike', "%{$search}%")
                    ->orWhere('recipient_name', 'ilike', "%{$search}%");
            }))
            ->latest('request_date')
            ->latest('id')
            ->paginate($request->integer('per_page', 20));

        return response()->json($certificates);
    }

    public function show(TemporaryCertificate $temporaryCertificate): JsonResponse
    {
        return response()->json($temporaryCertificate->load('preparer'));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $data['control_number'] = $this->nextControlNumber();
        $data['prepared_by'] = auth('api')->id();

        $certificate = TemporaryCertificate::create($data);

        $this->audit->log(
            'create',
            'temporary_certificate',
            "Created temporary certificate {$certificate->control_number}",
            newValues: $certificate->toArray(),
        );

        return response()->json($certificate->load('preparer'), 201);
    }

    public function update(Request $request, TemporaryCertificate $temporaryCertificate): JsonResponse
    {
        $data = $this->validated($request, updating: true);
        $temporaryCertificate->update($data);

        $this->audit->log(
            'update',
            'temporary_certificate',
            "Updated temporary certificate {$temporaryCertificate->control_number}",
            newValues: $temporaryCertificate->fresh()->toArray(),
        );

        return response()->json($temporaryCertificate->load('preparer'));
    }

    public function destroy(TemporaryCertificate $temporaryCertificate): JsonResponse
    {
        $controlNumber = $temporaryCertificate->control_number;
        $temporaryCertificate->delete();

        $this->audit->log('delete', 'temporary_certificate', "Deleted temporary certificate {$controlNumber}");

        return response()->json(['message' => 'Temporary certificate deleted.']);
    }

    private function validated(Request $request, bool $updating = false): array
    {
        $isDraft = $request->input('status', 'finalized') === 'draft';
        $required = $updating ? 'sometimes' : 'required';

        if ($isDraft) {
            return $request->validate([
                'request_date' => ['nullable', 'date'],
                'requester_name' => ['nullable', 'string', 'max:255'],
                'requester_position' => ['nullable', 'string', 'max:255'],
                'requester_office' => ['nullable', 'string', 'max:255'],
                'recipient_name' => ['nullable', 'string', 'max:255'],
                'recipient_position' => ['nullable', 'string', 'max:255'],
                'recipient_office' => ['nullable', 'string', 'max:255'],
                'transfer_reason' => ['nullable', 'string'],
                'conformed_name' => ['nullable', 'string', 'max:255'],
                'conformed_position' => ['nullable', 'string', 'max:255'],
                'conformed_office' => ['nullable', 'string', 'max:255'],
                'attested_name' => ['nullable', 'string', 'max:255'],
                'attested_position' => ['nullable', 'string', 'max:255'],
                'attested_office' => ['nullable', 'string', 'max:255'],
                'approved_name' => ['nullable', 'string', 'max:255'],
                'approved_position' => ['nullable', 'string', 'max:255'],
                'status' => ['nullable', 'in:draft,finalized'],
            ]);
        }

        return $request->validate([
            'request_date' => [$required, 'date'],
            'requester_name' => [$required, 'string', 'max:255'],
            'requester_position' => ['nullable', 'string', 'max:255'],
            'requester_office' => ['nullable', 'string', 'max:255'],
            'recipient_name' => [$required, 'string', 'max:255'],
            'recipient_position' => ['nullable', 'string', 'max:255'],
            'recipient_office' => ['nullable', 'string', 'max:255'],
            'transfer_reason' => [$required, 'string'],
            'conformed_name' => ['nullable', 'string', 'max:255'],
            'conformed_position' => ['nullable', 'string', 'max:255'],
            'conformed_office' => ['nullable', 'string', 'max:255'],
            'attested_name' => ['nullable', 'string', 'max:255'],
            'attested_position' => ['nullable', 'string', 'max:255'],
            'attested_office' => ['nullable', 'string', 'max:255'],
            'approved_name' => ['nullable', 'string', 'max:255'],
            'approved_position' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'in:draft,finalized'],
        ]);
    }

    private function nextControlNumber(): string
    {
        $yearSuffix = now()->format('y');
        $prefix = "{$yearSuffix}-";

        $latest = TemporaryCertificate::query()
            ->where('control_number', 'like', "{$prefix}%")
            ->orderByDesc('control_number')
            ->value('control_number');

        $sequence = 1;
        if ($latest && preg_match('/^(\d{2})-(\d+)$/', $latest, $matches)) {
            $sequence = ((int) $matches[2]) + 1;
        }

        return $prefix.str_pad((string) $sequence, 3, '0', STR_PAD_LEFT);
    }
}
