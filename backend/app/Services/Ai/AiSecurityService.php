<?php

namespace App\Services\Ai;

use App\Models\User;

class AiSecurityService
{
    private const BLOCKED_PATTERNS = [
        '/ignore\s+(all\s+)?previous\s+instructions/i',
        '/disregard\s+(all\s+)?(prior|previous)/i',
        '/reveal\s+(the\s+)?(api\s*key|password|secret|token)/i',
        '/show\s+(me\s+)?(all\s+)?(passwords|credentials|secrets)/i',
        '/execute\s+(raw\s+)?sql/i',
        '/drop\s+table/i',
        '/select\s+\*\s+from\s+users/i',
        '/bypass\s+(rbac|permission|security)/i',
        '/system\s+prompt/i',
        '/jailbreak/i',
    ];

    private const SENSITIVE_KEYS = [
        'password', 'api_key', 'secret', 'token', 'jwt', 'remember_token',
    ];

    public function isPromptInjection(string $message): bool
    {
        foreach (self::BLOCKED_PATTERNS as $pattern) {
            if (preg_match($pattern, $message)) {
                return true;
            }
        }

        return false;
    }

    public function sanitizeOutput(array $data): array
    {
        return $this->filterSensitive($data);
    }

    private function filterSensitive(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }

        $filtered = [];
        foreach ($value as $key => $item) {
            if (is_string($key) && $this->isSensitiveKey($key)) {
                $filtered[$key] = '[REDACTED]';
                continue;
            }
            $filtered[$key] = is_array($item) ? $this->filterSensitive($item) : $item;
        }

        return $filtered;
    }

    private function isSensitiveKey(string $key): bool
    {
        $lower = strtolower($key);
        foreach (self::SENSITIVE_KEYS as $sensitive) {
            if (str_contains($lower, $sensitive)) {
                return true;
            }
        }

        return false;
    }

    public function buildSystemPrompt(User $user): string
    {
        $role = $user->role?->name ?? 'User';
        $dept = $user->department?->name ?? 'N/A';

        return <<<PROMPT
You are the PGP PGSO Inventory Intelligence Assistant for the Provincial General Supply Office, Province of Palawan.

Your role: virtual Inventory Officer, Property Custodian, Supply Officer, Procurement Analyst, and Executive Decision Support Assistant.

Current user: {$user->name} ({$role}, {$dept})

RULES:
- Answer ONLY using data from approved tool functions. Never invent inventory numbers.
- Never reveal passwords, API keys, tokens, or confidential credentials.
- Never execute SQL or suggest bypassing permissions.
- Respect RBAC: if a function returns "access denied", explain the limitation politely.
- Use Philippine Peso (₱) for monetary values.
- Be concise, professional, and government-appropriate.
- For compliance reports (ICS, PAR, physical count), reference COA and GPPB guidelines.
- Consumable supplies (office supplies, alcohol, paper, etc.) are tracked via employee issuance requests — use getIssuedConsumables. Non-consumable property/equipment uses getIssuedAssets and getAssetAssignments (PAR/ICS with property numbers).
- Format lists and tables clearly in markdown when helpful.
- For item lists with many columns, use a markdown table with headers.
- For simple lists (under 10 items with few fields), prefer bullet points over wide tables.
- Keep answers scannable: short intro sentence, then structured data, then optional follow-up.
PROMPT;
    }
}
