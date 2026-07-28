<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmployeeMasterlistController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $employees = User::query()
            ->with([
                'department:id,name,code',
                'materialReleases' => function ($query) {
                    $query->with([
                        'items.inventoryItem:id,name,item_code,unit_of_measure,unit_cost,property_number',
                    ])
                        ->latest('release_date')
                        ->latest('id');
                },
                'accountabilityAssignments' => function ($query) {
                    $query->with([
                        'asset.inventoryItem:id,name,item_code,property_number,unit_cost,unit_of_measure',
                        'materialRelease:id,mr_number',
                        'materialReleaseItem:id,quantity,serial_number',
                    ])
                        ->whereIn('document_type', ['par', 'ics'])
                        ->latest('assignment_date')
                        ->latest('id');
                },
            ])
            ->where('is_active', true)
            ->when($request->search, function ($query, $search) {
                $query->where(function ($query) use ($search) {
                    $query->where('name', 'ilike', "%{$search}%")
                        ->orWhere('email', 'ilike', "%{$search}%")
                        ->orWhere('employee_id', 'ilike', "%{$search}%");
                });
            })
            ->when($request->department_id, fn ($query, $id) => $query->where('department_id', $id))
            ->orderBy('name')
            ->paginate($request->integer('per_page', 20));

        return response()->json($employees);
    }
}
