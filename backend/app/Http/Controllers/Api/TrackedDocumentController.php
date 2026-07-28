<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TrackedDocument;
use App\Models\TrackedDocumentAttachment;
use App\Models\User;
use App\Services\AuditService;
use App\Services\ExportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TrackedDocumentController extends Controller
{
    public function __construct(
        private AuditService $audit,
        private ExportService $export,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = auth('api')->user();
        $tab = $request->string('tab', 'all')->toString();
        $fileType = $request->string('file_type')->toString();

        $query = TrackedDocument::with(['responsible:id,name,email', 'department:id,name,code'])
            ->when($request->search, function ($q, $s) {
                $q->where(function ($q) use ($s) {
                    $q->where('title', 'ilike', "%{$s}%")
                        ->orWhere('reference_no', 'ilike', "%{$s}%")
                        ->orWhere('sender_name', 'ilike', "%{$s}%")
                        ->orWhere('recipient_name', 'ilike', "%{$s}%");
                });
            })
            ->when($fileType !== '', fn ($q) => $q->where('file_type', $fileType));

        $this->applyDivisionScope($query, $user);

        match ($tab) {
            'incoming' => $query->where('direction', 'incoming'),
            'outgoing' => $query->where('direction', 'outgoing'),
            'request' => $query->whereIn('direction', ['incoming', 'outgoing']),
            'active' => $query->where('status', 'active'),
            'completed' => $query->where('status', 'completed'),
            'pending' => $query->where('status', 'pending'),
            default => null,
        };

        $documents = $query->latest('created_at')
            ->paginate($request->integer('per_page', 20));

        return response()->json($documents);
    }

    public function report(Request $request): JsonResponse
    {
        $user = auth('api')->user();
        $from = $request->date('from')?->startOfDay() ?? now()->startOfMonth();
        $to = $request->date('to')?->endOfDay() ?? now()->endOfDay();
        $direction = $request->string('direction')->toString();
        $status = $request->string('status')->toString();

        $base = TrackedDocument::query()
            ->where(function ($q) use ($from, $to) {
                $q->whereBetween('created_at', [$from, $to])
                    ->orWhereBetween('received_at', [$from, $to])
                    ->orWhereBetween('released_at', [$from, $to]);
            });

        $this->applyDivisionScope($base, $user);

        $summaryQuery = (clone $base);
        $byDirection = (clone $summaryQuery)
            ->selectRaw('direction, count(*) as total')
            ->groupBy('direction')
            ->pluck('total', 'direction');
        $byStatus = (clone $summaryQuery)
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');
        $byType = (clone $summaryQuery)
            ->selectRaw("coalesce(nullif(document_type, ''), 'unspecified') as document_type, count(*) as total")
            ->groupBy('document_type')
            ->orderByDesc('total')
            ->limit(12)
            ->pluck('total', 'document_type');

        $listQuery = (clone $base)
            ->with(['responsible:id,name', 'department:id,name,code'])
            ->when($direction !== '', fn ($q) => $q->where('direction', $direction))
            ->when($status !== '', fn ($q) => $q->where('status', $status))
            ->latest('created_at');

        $documents = $listQuery->limit(500)->get([
            'id', 'reference_no', 'title', 'direction', 'document_type', 'status',
            'sender_name', 'recipient_name', 'department_id', 'responsible_user_id',
            'received_at', 'released_at', 'completed_at', 'created_at',
        ]);

        return response()->json([
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'totals' => [
                'all' => (int) $byDirection->sum(),
                'incoming' => (int) ($byDirection['incoming'] ?? 0),
                'outgoing' => (int) ($byDirection['outgoing'] ?? 0),
                'routing' => (int) ($byDirection['routing'] ?? 0),
                'internal' => (int) ($byDirection['internal'] ?? 0),
                'active' => (int) ($byStatus['active'] ?? 0),
                'completed' => (int) ($byStatus['completed'] ?? 0),
                'pending' => (int) ($byStatus['pending'] ?? 0),
                'archived' => (int) ($byStatus['archived'] ?? 0),
            ],
            'by_direction' => $byDirection,
            'by_status' => $byStatus,
            'by_document_type' => $byType,
            'documents' => $documents,
        ]);
    }

    public function exportPdf(Request $request)
    {
        $user = auth('api')->user();
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'mode' => ['nullable', 'string', 'max:40'],
        ]);

        $query = TrackedDocument::with(['responsible:id,name', 'department:id,name,code', 'creator:id,name'])
            ->whereIn('id', $data['ids']);

        $this->applyDivisionScope($query, $user);

        $documents = $query->orderBy('created_at')->get();

        if ($documents->isEmpty()) {
            return response()->json(['message' => 'No documents selected for export.'], 422);
        }

        $from = $data['from'] ?? $documents->min('created_at')?->toDateString() ?? now()->toDateString();
        $to = $data['to'] ?? $documents->max('created_at')?->toDateString() ?? now()->toDateString();
        $dateLabel = $from === $to
            ? \Carbon\Carbon::parse($from)->format('F j, Y')
            : \Carbon\Carbon::parse($from)->format('F j, Y').' – '.\Carbon\Carbon::parse($to)->format('F j, Y');

        $rows = $documents->map(function (TrackedDocument $doc) {
            $particular = collect([
                $doc->title,
                $doc->document_type ? strtoupper(str_replace('_', ' ', (string) $doc->document_type)) : null,
                $doc->department?->name,
                $doc->instruction_task ?: $doc->description,
            ])->filter()->implode(' - ');

            return [
                'control_no' => $doc->reference_no ?: '—',
                'origin' => $doc->sender_name ?: ($doc->creator?->name ?: '—'),
                'particular' => $particular !== '' ? $particular : '—',
                'admin' => $doc->responsible?->name ?: '',
                'end_user' => $doc->recipient_name ?: ($doc->instruction_for ?: ($doc->department?->name ?: '')),
            ];
        })->values()->all();

        $filename = 'Daily-Report-'.now()->format('Ymd-His');

        $logoCandidates = static function (string $name): ?string {
            foreach ([
                public_path($name),
                base_path('../frontend/public/'.$name),
                base_path('public/'.$name),
            ] as $path) {
                if (is_readable($path)) {
                    return $path;
                }
            }

            return null;
        };

        return $this->export->toPdf('reports.document-daily-report', [
            'republic' => 'Republic of the Philippines',
            'province' => 'Provincial Government of Palawan',
            'office' => 'Provincial General Services Office',
            'city' => 'City of Puerto Princesa',
            'dateLabel' => $dateLabel,
            'mode' => strtoupper((string) ($data['mode'] ?? 'ALL')),
            'rows' => $rows,
            'generatedAt' => now()->format('M d, Y h:i A'),
            'footer' => 'PGP PGSO — Inventory Management System — Document Tracking',
            'pgpLogo' => $logoCandidates('pgp-logo.jpg') ?? $logoCandidates('pgp-logo.png'),
            'pgsoLogo' => $logoCandidates('pgso-logo.jpg') ?? $logoCandidates('pgso-logo.png'),
        ], $filename, 'a4', 'landscape');
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'direction' => ['required', Rule::in(TrackedDocument::DIRECTIONS)],
            'document_type' => ['nullable', 'string', 'max:120'],
            'document_no' => ['nullable', 'string', 'max:80'],
            'file_type' => ['nullable', Rule::in(TrackedDocument::FILE_TYPES)],
            'status' => ['nullable', Rule::in(TrackedDocument::STATUSES)],
            'is_confidential' => ['nullable', 'boolean'],
            'sender_name' => ['nullable', 'string', 'max:255'],
            'recipient_name' => ['nullable', 'string', 'max:255'],
            'instruction_for' => ['nullable', 'string', 'max:255'],
            'instruction_task' => ['nullable', 'string'],
            'responsible_user_id' => ['nullable', 'exists:users,id'],
            'department_id' => ['nullable', 'exists:departments,id'],
            'reference_no' => ['nullable', 'string', 'max:60', 'unique:tracked_documents,reference_no'],
            'received_at' => ['nullable', 'date'],
            'released_at' => ['nullable', 'date'],
        ]);

        if ($denied = $this->forbiddenDirection($data['direction'])) {
            return $denied;
        }

        $data['reference_no'] = $data['reference_no'] ?? $this->nextReference($data['direction']);
        $data['document_type'] = $data['document_type'] ?? 'letter';
        $data['file_type'] = $data['file_type'] ?? 'pdf';
        $data['status'] = $data['status'] ?? 'active';
        $data['is_confidential'] = (bool) ($data['is_confidential'] ?? false);
        $data['created_by'] = auth('api')->id();
        $data['responsible_user_id'] = $data['responsible_user_id'] ?? auth('api')->id();

        if ($data['direction'] === 'incoming') {
            $data['received_at'] = $data['received_at'] ?? now();
        }
        if ($data['direction'] === 'outgoing') {
            $data['released_at'] = $data['released_at'] ?? now();
        }

        $doc = TrackedDocument::create($data);
        $this->audit->log('create', 'documents', "Logged document {$doc->reference_no}", newValues: $doc->toArray());

        return response()->json($doc->load(['responsible:id,name,email', 'department:id,name,code', 'tasks.creator:id,name']), 201);
    }

    public function show(TrackedDocument $trackedDocument): JsonResponse
    {
        if ($denied = $this->forbiddenDirection($trackedDocument->direction, viewOnly: true)) {
            return $denied;
        }

        return response()->json($trackedDocument->load([
            'responsible:id,name,email',
            'department:id,name,code',
            'creator:id,name',
            'tasks.creator:id,name',
            'attachments.uploader:id,name',
        ]));
    }

    public function update(Request $request, TrackedDocument $trackedDocument): JsonResponse
    {
        if ($denied = $this->forbiddenDirection($trackedDocument->direction)) {
            return $denied;
        }

        $old = $trackedDocument->toArray();
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'direction' => ['sometimes', Rule::in(TrackedDocument::DIRECTIONS)],
            'document_type' => ['sometimes', 'string', 'max:120'],
            'document_no' => ['nullable', 'string', 'max:80'],
            'file_type' => ['sometimes', Rule::in(TrackedDocument::FILE_TYPES)],
            'status' => ['sometimes', Rule::in(TrackedDocument::STATUSES)],
            'is_confidential' => ['nullable', 'boolean'],
            'sender_name' => ['nullable', 'string', 'max:255'],
            'recipient_name' => ['nullable', 'string', 'max:255'],
            'instruction_for' => ['nullable', 'string', 'max:255'],
            'instruction_task' => ['nullable', 'string'],
            'responsible_user_id' => ['nullable', 'exists:users,id'],
            'department_id' => ['nullable', 'exists:departments,id'],
            'received_at' => ['nullable', 'date'],
            'released_at' => ['nullable', 'date'],
        ]);

        if (isset($data['direction']) && ($denied = $this->forbiddenDirection($data['direction']))) {
            return $denied;
        }

        if (($data['status'] ?? null) === 'completed' && ! $trackedDocument->completed_at) {
            $data['completed_at'] = now();
        }

        $trackedDocument->update($data);
        $this->audit->log('update', 'documents', "Updated document {$trackedDocument->reference_no}", $old, $trackedDocument->fresh()->toArray());

        return response()->json($trackedDocument->fresh()->load([
            'responsible:id,name,email',
            'department:id,name,code',
            'tasks.creator:id,name',
            'attachments.uploader:id,name',
        ]));
    }

    public function storeTask(Request $request, TrackedDocument $trackedDocument): JsonResponse
    {
        if ($denied = $this->forbiddenDirection($trackedDocument->direction)) {
            return $denied;
        }

        $data = $request->validate([
            'assigned_to' => ['nullable', 'string', 'max:255'],
            'body' => ['required', 'string'],
            'received_by' => ['nullable', 'string', 'max:255'],
            'received_at' => ['nullable', 'date'],
            'direction' => ['nullable', Rule::in(TrackedDocument::DIRECTIONS)],
            'is_confidential' => ['nullable', 'boolean'],
            'reference_no' => ['nullable', 'string', 'max:60'],
            'document_type' => ['nullable', 'string', 'max:120'],
            'department_id' => ['nullable', 'exists:departments,id'],
        ]);

        $receivedAt = isset($data['received_at'])
            ? $data['received_at']
            : (! empty($data['received_by']) ? now() : null);

        $task = $trackedDocument->tasks()->create([
            'assigned_to' => $data['assigned_to'] ?? null,
            'body' => $data['body'],
            'received_by' => $data['received_by'] ?? null,
            'received_at' => $receivedAt,
            'created_by' => auth('api')->id(),
        ]);

        $docUpdates = [
            'instruction_for' => $data['assigned_to'] ?? $trackedDocument->instruction_for,
            'instruction_task' => $data['body'],
        ];
        if (array_key_exists('direction', $data) && $data['direction']) {
            $docUpdates['direction'] = $data['direction'];
        }
        if (array_key_exists('is_confidential', $data)) {
            $docUpdates['is_confidential'] = (bool) $data['is_confidential'];
        }
        if (! empty($data['document_type'])) {
            $docUpdates['document_type'] = $data['document_type'];
        }
        if (array_key_exists('department_id', $data)) {
            $docUpdates['department_id'] = $data['department_id'];
        }
        if (! empty($data['reference_no']) && $data['reference_no'] !== $trackedDocument->reference_no) {
            $exists = TrackedDocument::where('reference_no', $data['reference_no'])
                ->where('id', '!=', $trackedDocument->id)
                ->exists();
            if (! $exists) {
                $docUpdates['reference_no'] = $data['reference_no'];
            }
        }
        $trackedDocument->update($docUpdates);

        $this->audit->log('create', 'documents', "Added task on {$trackedDocument->reference_no}", newValues: $task->toArray());

        return response()->json($task->load('creator:id,name'), 201);
    }

    public function storeAttachment(Request $request, TrackedDocument $trackedDocument): JsonResponse
    {
        if ($denied = $this->forbiddenDirection($trackedDocument->direction)) {
            return $denied;
        }

        $request->validate([
            'files' => ['required', 'array', 'min:1', 'max:20'],
            'files.*' => [
                'required',
                'file',
                'max:3072', // 3MB per file
                'mimes:pdf,doc,docx,xls,xlsx,csv,png,jpg,jpeg,gif,webp,txt',
            ],
        ]);

        $uploaded = [];
        $latestPath = null;
        $latestType = null;

        foreach ($request->file('files', []) as $file) {
            $path = $file->store("document-attachments/{$trackedDocument->id}", 'local');
            $mime = $file->getMimeType() ?? 'application/octet-stream';

            $attachment = $trackedDocument->attachments()->create([
                'uploaded_by' => auth('api')->id(),
                'file_name' => $file->getClientOriginalName(),
                'file_path' => $path,
                'mime_type' => $mime,
                'file_size' => $file->getSize(),
            ]);

            $uploaded[] = $attachment->load('uploader:id,name');
            $latestPath = $path;
            $latestType = $this->guessFileType($file->getClientOriginalExtension(), $mime);

            $this->audit->log(
                'create',
                'documents',
                "Uploaded file {$attachment->file_name} to {$trackedDocument->reference_no}",
                newValues: $attachment->toArray(),
            );
        }

        if ($latestPath) {
            $trackedDocument->update([
                'file_path' => $latestPath,
                'file_type' => $latestType ?? $trackedDocument->file_type,
            ]);
        }

        return response()->json([
            'message' => count($uploaded) === 1 ? 'File uploaded.' : count($uploaded).' files uploaded.',
            'data' => $uploaded,
        ], 201);
    }

    public function downloadAttachment(
        TrackedDocument $trackedDocument,
        TrackedDocumentAttachment $attachment,
    ): StreamedResponse|JsonResponse {
        if ($denied = $this->forbiddenDirection($trackedDocument->direction, viewOnly: true)) {
            return $denied;
        }

        if ((int) $attachment->tracked_document_id !== (int) $trackedDocument->id) {
            return response()->json(['message' => 'Attachment not found for this document.'], 404);
        }

        if (! Storage::disk('local')->exists($attachment->file_path)) {
            return response()->json(['message' => 'File not found on server.'], 404);
        }

        return Storage::disk('local')->download(
            $attachment->file_path,
            $attachment->file_name,
            ['Content-Type' => $attachment->mime_type ?? 'application/octet-stream'],
        );
    }

    public function destroyAttachment(
        TrackedDocument $trackedDocument,
        TrackedDocumentAttachment $attachment,
    ): JsonResponse {
        if ($denied = $this->forbiddenDirection($trackedDocument->direction)) {
            return $denied;
        }

        if ((int) $attachment->tracked_document_id !== (int) $trackedDocument->id) {
            return response()->json(['message' => 'Attachment not found for this document.'], 404);
        }

        $name = $attachment->file_name;
        if (Storage::disk('local')->exists($attachment->file_path)) {
            Storage::disk('local')->delete($attachment->file_path);
        }
        $attachment->delete();

        $latest = $trackedDocument->attachments()->latest('id')->first();
        $trackedDocument->update(['file_path' => $latest?->file_path]);

        $this->audit->log('delete', 'documents', "Removed file {$name} from {$trackedDocument->reference_no}");

        return response()->json(['message' => 'Attachment removed.']);
    }

    public function destroy(TrackedDocument $trackedDocument): JsonResponse
    {
        if ($denied = $this->forbiddenDirection($trackedDocument->direction)) {
            return $denied;
        }

        $ref = $trackedDocument->reference_no;
        $trackedDocument->delete();
        $this->audit->log('delete', 'documents', "Archived document {$ref}");

        return response()->json(['message' => 'Document archived.']);
    }

    private function nextReference(string $direction): string
    {
        $prefix = match ($direction) {
            'incoming' => 'IN',
            'outgoing' => 'OUT',
            'routing' => 'RT',
            default => 'DOC',
        };
        $year = now()->format('Y');
        $seq = TrackedDocument::withTrashed()
            ->where('reference_no', 'like', "{$prefix}-{$year}-%")
            ->count() + 1;

        return sprintf('%s-%s-%04d', $prefix, $year, $seq);
    }

    private function applyDivisionScope($query, ?User $user): void
    {
        if (! $user) {
            return;
        }

        if ($user->hasPermission('*') || $user->hasPermission('documents.*')) {
            return;
        }

        $allowed = [];
        if ($user->hasPermission('documents.incoming')) {
            $allowed[] = 'incoming';
        }
        if ($user->hasPermission('documents.outgoing')) {
            $allowed[] = 'outgoing';
        }
        if ($user->hasPermission('documents.routing')) {
            $allowed[] = 'routing';
        }
        if ($user->hasPermission('documents.records')) {
            // Records staff see all directions
            return;
        }

        if ($allowed === [] && $user->hasPermission('documents.view')) {
            // Base view without division — show nothing actionable by default
            $query->whereRaw('1 = 0');

            return;
        }

        if ($allowed !== []) {
            $query->whereIn('direction', $allowed);
        }
    }

    private function forbiddenDirection(string $direction, bool $viewOnly = false): ?JsonResponse
    {
        $user = auth('api')->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        if ($user->hasPermission('*') || $user->hasPermission('documents.*')) {
            return null;
        }

        $ok = match ($direction) {
            'incoming' => $user->hasPermission('documents.incoming') || ($viewOnly && $user->hasPermission('documents.view')),
            'outgoing' => $user->hasPermission('documents.outgoing') || ($viewOnly && $user->hasPermission('documents.view')),
            'routing' => $user->hasPermission('documents.routing') || ($viewOnly && $user->hasPermission('documents.view')),
            'internal' => $user->hasPermission('documents.records') || $user->hasPermission('documents.incoming') || $user->hasPermission('documents.outgoing'),
            default => $user->hasPermission('documents.records'),
        };

        if ($user->hasPermission('documents.records')) {
            $ok = true;
        }

        if (! $ok && ! $viewOnly) {
            return response()->json([
                'message' => 'Your task division does not allow this document action.',
            ], 403);
        }

        if (! $ok && $viewOnly && ! $user->hasPermission('documents.view')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return null;
    }

    private function guessFileType(string $extension, ?string $mime): string
    {
        $ext = strtolower($extension);
        if (in_array($ext, ['pdf'], true) || str_contains((string) $mime, 'pdf')) {
            return 'pdf';
        }
        if (in_array($ext, ['xls', 'xlsx', 'csv'], true) || str_contains((string) $mime, 'sheet') || str_contains((string) $mime, 'excel')) {
            return 'xls';
        }
        if (in_array($ext, ['doc', 'docx'], true) || str_contains((string) $mime, 'word')) {
            return 'doc';
        }
        if (in_array($ext, ['png', 'jpg', 'jpeg', 'gif', 'webp'], true) || str_starts_with((string) $mime, 'image/')) {
            return 'image';
        }

        return 'other';
    }
}
