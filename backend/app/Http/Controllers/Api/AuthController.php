<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Enums\RoleSlug;
use App\Models\Department;
use App\Models\RefreshToken;
use App\Models\Role;
use App\Models\User;
use App\Services\AuditService;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    public function __construct(
        private AuditService $audit,
        private NotificationService $notifications,
    ) {}

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::with('role', 'department')->where('email', $credentials['email'])->first();

        if ($user && ! $user->is_active) {
            return response()->json(['message' => 'Your account is pending administrator approval.'], 403);
        }

        if (! $user || ! $user->is_active) {
            return response()->json(['message' => 'Invalid credentials or inactive account.'], 401);
        }

        if ($user->isLocked()) {
            return response()->json(['message' => 'Account is locked. Try again later.'], 423);
        }

        if (! Hash::check($credentials['password'], $user->password)) {
            $user->increment('failed_login_attempts');
            if ($user->failed_login_attempts >= 5) {
                $user->update(['locked_until' => now()->addMinutes(30)]);
            }

            return response()->json(['message' => 'Invalid credentials.'], 401);
        }

        $user->update(['failed_login_attempts' => 0, 'locked_until' => null, 'last_login_at' => now()]);

        $token = auth('api')->login($user);
        $refreshToken = $this->createRefreshToken($user, $request->ip());

        $this->audit->log('login', 'auth', "User {$user->email} logged in", userId: $user->id);

        return response()->json([
            'access_token' => $token,
            'token_type' => 'bearer',
            'expires_in' => auth('api')->factory()->getTTL() * 60,
            'refresh_token' => $refreshToken,
            'user' => $this->userPayload($user),
        ]);
    }

    public function refresh(Request $request): JsonResponse
    {
        $data = $request->validate(['refresh_token' => ['required', 'string']]);

        $stored = RefreshToken::where('token', hash('sha256', $data['refresh_token']))
            ->where('expires_at', '>', now())
            ->first();

        if (! $stored) {
            return response()->json(['message' => 'Invalid refresh token.'], 401);
        }

        $user = User::with('role', 'department')->findOrFail($stored->user_id);
        $stored->delete();

        $token = auth('api')->login($user);
        $refreshToken = $this->createRefreshToken($user, $request->ip());

        return response()->json([
            'access_token' => $token,
            'token_type' => 'bearer',
            'expires_in' => auth('api')->factory()->getTTL() * 60,
            'refresh_token' => $refreshToken,
            'user' => $this->userPayload($user),
        ]);
    }

    public function logout(): JsonResponse
    {
        $user = auth('api')->user();
        if ($user) {
            RefreshToken::where('user_id', $user->id)->delete();
            $this->audit->log('logout', 'auth', "User {$user->email} logged out");
            auth('api')->logout();
        }

        return response()->json(['message' => 'Logged out successfully.']);
    }

    public function me(): JsonResponse
    {
        $user = User::with('role', 'department')->findOrFail(auth('api')->id());

        return response()->json($this->userPayload($user));
    }

    public function changePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'confirmed', Password::min(8)->mixedCase()->numbers()],
        ]);

        $user = auth('api')->user();
        if (! Hash::check($data['current_password'], $user->password)) {
            return response()->json(['message' => 'Current password is incorrect.'], 422);
        }

        $user->update(['password' => $data['password'], 'password_changed_at' => now()]);
        $this->audit->log('update', 'auth', 'Password changed');

        return response()->json(['message' => 'Password updated successfully.']);
    }

    public function registrationDepartments(): JsonResponse
    {
        $departments = Department::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        return response()->json(['data' => $departments]);
    }

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'confirmed', Password::min(8)->mixedCase()->numbers()],
            'department_id' => ['required', 'exists:departments,id'],
            'employee_id' => ['nullable', 'string', 'max:50'],
            'phone' => ['nullable', 'string', 'max:30'],
        ]);

        $existing = User::withTrashed()->where('email', $data['email'])->first();
        if ($existing) {
            if (! $existing->trashed() && ! $existing->is_active) {
                return response()->json([
                    'message' => 'An account with this email is already pending administrator approval.',
                ], 422);
            }

            return response()->json(['message' => 'An account with this email already exists.'], 422);
        }

        if (! empty($data['employee_id']) && User::withTrashed()->where('employee_id', $data['employee_id'])->exists()) {
            return response()->json(['message' => 'This employee ID is already registered.'], 422);
        }

        $role = Role::where('slug', RoleSlug::DepartmentUser->value)->firstOrFail();

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
            'role_id' => $role->id,
            'department_id' => $data['department_id'],
            'employee_id' => $data['employee_id'] ?? null,
            'phone' => $data['phone'] ?? null,
            'is_active' => false,
        ]);

        $user->load('department');
        $this->notifications->notifyAccountRegistrationPending($user);
        $this->audit->log('create', 'auth', "Registration submitted for {$user->email}", newValues: $user->toArray());

        return response()->json([
            'message' => 'Account created successfully. An administrator must approve your account before you can sign in.',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
        ], 201);
    }

    private function createRefreshToken(User $user, ?string $ip): string
    {
        $plain = Str::random(64);
        RefreshToken::create([
            'user_id' => $user->id,
            'token' => hash('sha256', $plain),
            'expires_at' => now()->addMinutes((int) config('jwt.refresh_ttl', 20160)),
            'ip_address' => $ip,
        ]);

        return $plain;
    }

    private function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'employee_id' => $user->employee_id,
            'phone' => $user->phone,
            'role' => $user->role?->only(['id', 'name', 'slug']),
            'department' => $user->department?->only(['id', 'name', 'code']),
            'document_task_division' => $user->document_task_division,
            'permissions' => $user->effectivePermissions(),
        ];
    }
}
