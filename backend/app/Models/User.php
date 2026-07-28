<?php

namespace App\Models;

use App\Enums\DocumentTaskDivision;
use App\Enums\RoleSlug;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use PHPOpenSourceSaver\JWTAuth\Contracts\JWTSubject;

class User extends Authenticatable implements JWTSubject
{
    use HasFactory, Notifiable, SoftDeletes;

    /** @use HasFactory<UserFactory> */
    protected $fillable = [
        'name', 'email', 'password', 'role_id', 'document_task_division', 'department_id',
        'employee_id', 'phone', 'is_active',
        'driver_license_number', 'driver_license_type', 'driver_license_expiry', 'driver_license_status',
        'driver_license_issued_at', 'driver_license_restrictions', 'driver_license_conditions',
        'driver_license_blood_type', 'driver_license_date_of_birth', 'driver_license_sex',
        'driver_license_nationality', 'driver_license_address', 'driver_license_agency_code',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'locked_until' => 'datetime',
            'last_login_at' => 'datetime',
            'password_changed_at' => 'datetime',
            'driver_license_expiry' => 'date',
            'driver_license_issued_at' => 'date',
            'driver_license_date_of_birth' => 'date',
        ];
    }

    public function getJWTIdentifier(): mixed
    {
        return $this->getKey();
    }

    public function getJWTCustomClaims(): array
    {
        return [
            'role' => $this->role?->slug,
            'permissions' => $this->effectivePermissions(),
            'document_task_division' => $this->document_task_division,
        ];
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function materialReleases(): HasMany
    {
        return $this->hasMany(MaterialRelease::class, 'recipient_user_id');
    }

    public function accountabilityAssignments(): HasMany
    {
        return $this->hasMany(AssetAssignment::class, 'custodian_user_id');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }

    public function presence(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(UserPresence::class);
    }

    public function isLocked(): bool
    {
        return $this->locked_until && $this->locked_until->isFuture();
    }

    public function hasPermission(string $permission): bool
    {
        $permissions = $this->effectivePermissions();

        if (in_array('*', $permissions, true)) {
            return true;
        }

        foreach ($permissions as $perm) {
            if ($perm === $permission) {
                return true;
            }
            if (str_ends_with($perm, '.*')) {
                $prefix = rtrim($perm, '.*');
                if (str_starts_with($permission, $prefix)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * @return list<string>
     */
    public function effectivePermissions(): array
    {
        $permissions = $this->role?->permissions ?? [];

        if (in_array('*', $permissions, true)) {
            return ['*'];
        }

        if ($this->role?->slug === RoleSlug::DocumentTracking->value) {
            $division = DocumentTaskDivision::tryFrom((string) $this->document_task_division)
                ?? DocumentTaskDivision::IncomingOutgoing;
            $permissions = array_values(array_unique([
                ...$permissions,
                ...$division->permissions(),
            ]));
        }

        return $permissions;
    }

    public function isDocumentTracker(): bool
    {
        return RoleSlug::tryFrom((string) $this->role?->slug)?->isDocumentTrackingFamily() === true;
    }

    public function isAuditor(): bool
    {
        return $this->role?->slug === RoleSlug::Auditor->value;
    }
}
