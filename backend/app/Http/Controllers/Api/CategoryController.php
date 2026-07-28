<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function __construct(private AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $categories = Category::query()
            ->when($request->search, fn ($q, $s) => $q->where('name', 'ilike', "%{$s}%"))
            ->when($request->has('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->withCount('inventoryItems')
            ->orderBy('name')
            ->paginate($request->integer('per_page', 20));

        return response()->json($categories);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:20', 'unique:categories,code'],
            'description' => ['nullable', 'string'],
        ]);

        $category = Category::create([...$data, 'is_active' => true]);
        $this->audit->log('create', 'categories', "Created category {$category->name}", newValues: $category->toArray());

        return response()->json($category, 201);
    }

    public function show(Category $category): JsonResponse
    {
        return response()->json($category->loadCount('inventoryItems'));
    }

    public function update(Request $request, Category $category): JsonResponse
    {
        $old = $category->toArray();
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'code' => ['sometimes', 'string', 'max:20', "unique:categories,code,{$category->id}"],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $category->update($data);
        $this->audit->log('update', 'categories', "Updated category {$category->name}", $old, $category->fresh()->toArray());

        return response()->json($category);
    }

    public function destroy(Category $category): JsonResponse
    {
        if ($category->inventoryItems()->exists()) {
            return response()->json(['message' => 'Cannot delete category with inventory items.'], 422);
        }

        $category->delete();
        $this->audit->log('delete', 'categories', "Deleted category {$category->name}");

        return response()->json(['message' => 'Category deleted successfully.']);
    }
}
