<?php

namespace App\Http\Controllers\Api;

use App\Enums\DocumentTaskDivision;
use App\Enums\RoleSlug;
use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Services\AuditService;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;

class UserController extends Controller
{
    public function __construct(
        private AuditService $audit,
        private NotificationService $notifications,
    ) {}

    public function pendingRegistrations(): JsonResponse
    {
        $users = User::with(['role', 'department'])
            ->where('is_active', false)
            ->latest()
            ->get();

        return response()->json(['data' => $users]);
    }

    public function approveRegistration(User $user): JsonResponse
    {
        if ($user->is_active) {
            return response()->json(['message' => 'Account is already active.'], 422);
        }

        $user->update(['is_active' => true]);
        $this->notifications->notifyAccountApproved($user);
        $this->audit->log('approval', 'users', "Approved registration for {$user->email}", userId: auth('api')->id());

        return response()->json([
            'message' => 'Account approved successfully.',
            'user' => $user->fresh()->load('role', 'department'),
        ]);
    }

    public function rejectRegistration(Request $request, User $user): JsonResponse
    {
        if ($user->is_active) {
            return response()->json(['message' => 'Cannot reject an active account.'], 422);
        }

        if ($user->id === auth('api')->id()) {
            return response()->json(['message' => 'Cannot reject your own account.'], 422);
        }

        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $email = $user->email;
        $this->notifications->notifyAccountRejected($user);
        $user->delete();
        $this->audit->log(
            'approval',
            'users',
            "Rejected registration for {$email}".(! empty($data['reason']) ? ": {$data['reason']}" : ''),
            userId: auth('api')->id(),
        );

        return response()->json(['message' => 'Registration rejected.']);
    }

    public function index(Request $request): JsonResponse
    {
        $users = User::with(['role', 'department'])
            ->when($request->search, fn ($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('name', 'ilike', "%{$s}%")
                    ->orWhere('email', 'ilike', "%{$s}%")
                    ->orWhere('employee_id', 'ilike', "%{$s}%");
            }))
            ->when($request->role_id, fn ($q, $id) => $q->where('role_id', $id))
            ->when($request->has('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->latest()
            ->paginate($request->integer('per_page', 15));

        return response()->json($users);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', Password::min(8)->mixedCase()->numbers()],
            'role_id' => ['required', 'exists:roles,id'],
            'document_task_division' => ['nullable', 'string', 'in:'.implode(',', array_column(DocumentTaskDivision::cases(), 'value'))],
            'department_id' => ['nullable', 'exists:departments,id'],
            'employee_id' => ['nullable', 'string', 'max:50', 'unique:users,employee_id'],
            'phone' => ['nullable', 'string', 'max:30'],
        ]);

        if ($denied = $this->forbiddenSpecialRoleAssignment((int) $data['role_id'])) {
            return $denied;
        }

        if ($error = $this->validateDocumentTaskDivision($data)) {
            return $error;
        }

        $data = $this->normalizeDocumentDivision($data);

        $user = User::create([...$data, 'is_active' => true, 'password_changed_at' => now()]);
        $this->audit->log('create', 'users', "Created user {$user->email}", newValues: $user->toArray());

        return response()->json($user->load('role', 'department'), 201);
    }

    public function show(User $user): JsonResponse
    {
        return response()->json($user->load('role', 'department'));
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $old = $user->toArray();
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', "unique:users,email,{$user->id}"],
            'role_id' => ['sometimes', 'exists:roles,id'],
            'document_task_division' => ['nullable', 'string', 'in:'.implode(',', array_column(DocumentTaskDivision::cases(), 'value'))],
            'department_id' => ['nullable', 'exists:departments,id'],
            'employee_id' => ['nullable', 'string', 'max:50', "unique:users,employee_id,{$user->id}"],
            'phone' => ['nullable', 'string', 'max:30'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (isset($data['role_id']) && ($denied = $this->forbiddenSpecialRoleAssignment((int) $data['role_id']))) {
            return $denied;
        }

        $merged = array_merge($user->only(['role_id', 'document_task_division']), $data);
        if ($error = $this->validateDocumentTaskDivision($merged)) {
            return $error;
        }
        $data = $this->normalizeDocumentDivision($data, (int) ($merged['role_id'] ?? $user->role_id));

        $user->update($data);
        $this->audit->log('update', 'users', "Updated user {$user->email}", $old, $user->fresh()->toArray());

        return response()->json($user->load('role', 'department'));
    }

    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'password' => ['required', Password::min(8)->mixedCase()->numbers()],
        ]);

        $user->update(['password' => $data['password'], 'password_changed_at' => now(), 'failed_login_attempts' => 0, 'locked_until' => null]);
        $this->audit->log('update', 'users', "Reset password for {$user->email}");

        return response()->json(['message' => 'Password reset successfully.']);
    }

    public function destroy(User $user): JsonResponse
    {
        if ($user->id === auth('api')->id()) {
            return response()->json(['message' => 'Cannot deactivate your own account.'], 422);
        }

        $user->update(['is_active' => false]);
        $user->delete();
        $this->audit->log('delete', 'users', "Deactivated user {$user->email}");

        return response()->json(['message' => 'User deactivated successfully.']);
    }

    private function forbiddenSpecialRoleAssignment(int $roleId): ?JsonResponse
    {
        $target = Role::find($roleId);
        if (! $target) {
            return null;
        }

        $actorSlug = auth('api')->user()?->role?->slug;

        if ($target->slug === RoleSlug::FleetOfficer->value
            && ! in_array($actorSlug, [RoleSlug::Admin->value, RoleSlug::FleetOfficer->value], true)) {
            return response()->json([
                'message' => 'The Fleet Officer role can only be assigned by System Administrator or Fleet Officer accounts.',
            ], 403);
        }

        if ($target->slug === RoleSlug::DocumentTracking->value
            && ! in_array($actorSlug, [
                RoleSlug::Admin->value,
                RoleSlug::DocumentTracking->value,
                RoleSlug::DocumentTrackingAdmin->value,
            ], true)) {
            return response()->json([
                'message' => 'The Document Tracking role can only be assigned by System Administrator or Document Tracking accounts.',
            ], 403);
        }

        if ($target->slug === RoleSlug::DocumentTrackingAdmin->value
            && ! in_array($actorSlug, [
                RoleSlug::Admin->value,
                RoleSlug::DocumentTrackingAdmin->value,
            ], true)) {
            return response()->json([
                'message' => 'The Document Tracking/Admin role can only be assigned by System Administrator or Document Tracking/Admin accounts.',
            ], 403);
        }

        return null;
    }

    private function validateDocumentTaskDivision(array $data): ?JsonResponse
    {
        $role = Role::find($data['role_id'] ?? null);
        if (! $role || $role->slug !== RoleSlug::DocumentTracking->value) {
            return null;
        }

        $division = $data['document_task_division'] ?? null;
        if (! $division || ! DocumentTaskDivision::tryFrom((string) $division)) {
            return response()->json([
                'message' => 'Select a Document Tracking task division (e.g. Incoming & Outgoing).',
            ], 422);
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalizeDocumentDivision(array $data, ?int $roleId = null): array
    {
        $role = Role::find($roleId ?? ($data['role_id'] ?? null));
        if (! $role || $role->slug !== RoleSlug::DocumentTracking->value) {
            $data['document_task_division'] = null;
        }

        return $data;
    }
}
