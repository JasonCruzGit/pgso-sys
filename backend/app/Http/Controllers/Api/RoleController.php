<?php

namespace App\Http\Controllers\Api;

use App\Enums\DocumentTaskDivision;
use App\Enums\RoleSlug;
use App\Http\Controllers\Controller;
use App\Models\Role;
use Illuminate\Http\JsonResponse;

class RoleController extends Controller
{
    public function index(): JsonResponse
    {
        $actor = auth('api')->user();
        $actorSlug = $actor?->role?->slug;

        $canSeeFleetRole = in_array($actorSlug, [
            RoleSlug::Admin->value,
            RoleSlug::FleetOfficer->value,
        ], true);

        $canSeeDocumentTrackingRole = in_array($actorSlug, [
            RoleSlug::Admin->value,
            RoleSlug::DocumentTracking->value,
            RoleSlug::DocumentTrackingAdmin->value,
        ], true);

        $canSeeDocumentTrackingAdminRole = in_array($actorSlug, [
            RoleSlug::Admin->value,
            RoleSlug::DocumentTrackingAdmin->value,
        ], true);

        $roles = Role::orderBy('name')->get()
            ->reject(function (Role $role) use ($canSeeFleetRole, $canSeeDocumentTrackingRole, $canSeeDocumentTrackingAdminRole) {
                if ($role->slug === RoleSlug::FleetOfficer->value && ! $canSeeFleetRole) {
                    return true;
                }
                if ($role->slug === RoleSlug::DocumentTracking->value && ! $canSeeDocumentTrackingRole) {
                    return true;
                }
                if ($role->slug === RoleSlug::DocumentTrackingAdmin->value && ! $canSeeDocumentTrackingAdminRole) {
                    return true;
                }

                return false;
            })
            ->values()
            ->map(function (Role $role) {
                $payload = $role->toArray();
                if ($role->slug === RoleSlug::DocumentTracking->value) {
                    $payload['requires_task_division'] = true;
                    $payload['task_divisions'] = DocumentTaskDivision::options();
                }

                return $payload;
            });

        return response()->json($roles);
    }
}
