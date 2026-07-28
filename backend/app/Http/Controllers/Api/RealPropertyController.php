<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RealProperty;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RealPropertyController extends Controller
{
    public function __construct(private AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $properties = RealProperty::with('department')
            ->when($request->search, fn ($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('account_name', 'ilike', "%{$s}%")
                    ->orWhere('property_no', 'ilike', "%{$s}%")
                    ->orWhere('article', 'ilike', "%{$s}%")
                    ->orWhere('location', 'ilike', "%{$s}%")
                    ->orWhere('office', 'ilike', "%{$s}%")
                    ->orWhere('obr_no', 'ilike', "%{$s}%")
                    ->orWhere('description', 'ilike', "%{$s}%");
            }))
            ->when($request->article, fn ($q, $article) => $q->where('article', 'ilike', "%{$article}%"))
            ->when($request->status, fn ($q, $status) => $q->where('status', $status))
            ->when($request->office, fn ($q, $office) => $q->where('office', 'ilike', "%{$office}%"))
            ->orderBy('account_name')
            ->paginate($request->integer('per_page', 30));

        return response()->json($properties);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        $property = RealProperty::create($data);

        $this->audit->log('create', 'real_properties', "Added real property {$property->property_no}", newValues: $property->toArray());

        return response()->json($property->load('department'), 201);
    }

    public function show(RealProperty $realProperty): JsonResponse
    {
        return response()->json($realProperty->load('department'));
    }

    public function update(Request $request, RealProperty $realProperty): JsonResponse
    {
        $data = $this->validated($request, $realProperty->id);

        $old = $realProperty->toArray();
        $realProperty->update($data);

        $this->audit->log('update', 'real_properties', "Updated real property {$realProperty->property_no}", oldValues: $old, newValues: $realProperty->fresh()->toArray());

        return response()->json($realProperty->load('department'));
    }

    public function destroy(RealProperty $realProperty): JsonResponse
    {
        $code = $realProperty->property_no;
        $realProperty->delete();

        $this->audit->log('delete', 'real_properties', "Removed real property {$code}");

        return response()->json(['message' => 'Real property removed.']);
    }

    private function validated(Request $request, ?int $ignoreId = null): array
    {
        return $request->validate([
            'account_name' => ['required', 'string', 'max:255'],
            'property_no' => [
                'required', 'string', 'max:50',
                Rule::unique('real_properties', 'property_no')->ignore($ignoreId),
            ],
            'article' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string'],
            'location' => ['nullable', 'string', 'max:500'],
            'qty' => ['nullable', 'numeric', 'min:0'],
            'uom' => ['nullable', 'string', 'max:30'],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'acquisition_cost' => ['nullable', 'numeric', 'min:0'],
            'acquisition_date' => ['nullable', 'date'],
            'status' => ['sometimes', Rule::in(RealProperty::STATUSES)],
            'office' => ['nullable', 'string', 'max:255'],
            'department_id' => ['nullable', 'exists:departments,id'],
            'obr_no' => ['nullable', 'string', 'max:100'],
            'remarks' => ['nullable', 'string'],
            'source' => ['nullable', 'string', 'max:100'],
        ]);
    }
}
