<?php

namespace App\Services\Ai;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OpenAiService
{
    private function apiKey(): ?string
    {
        $key = config('ai.openai.api_key') ?: env('OPENAI_API_KEY');

        return is_string($key) && $key !== '' ? $key : null;
    }

    public function isConfigured(): bool
    {
        return $this->apiKey() !== null;
    }

    /**
     * @param  array<int, array<string, mixed>>  $messages
     * @param  array<int, array<string, mixed>>  $tools
     * @return array{content: ?string, tool_calls: array, tokens: int, finish_reason: string}
     */
    public function chat(array $messages, array $tools = []): array
    {
        if (! $this->isConfigured()) {
            return [
                'content' => 'AI service is not configured. Please set OPENAI_API_KEY in the environment.',
                'tool_calls' => [],
                'tokens' => 0,
                'finish_reason' => 'error',
            ];
        }

        $payload = [
            'model' => config('ai.openai.model'),
            'messages' => $messages,
            'max_tokens' => config('ai.openai.max_tokens'),
            'temperature' => 0.3,
        ];

        if (! empty($tools)) {
            $payload['tools'] = $tools;
            $payload['tool_choice'] = 'auto';
        }

        try {
            $response = Http::withToken($this->apiKey())
                ->timeout(config('ai.openai.timeout'))
                ->post('https://api.openai.com/v1/chat/completions', $payload);

            if (! $response->successful()) {
                Log::error('OpenAI API error', ['status' => $response->status(), 'body' => $response->body()]);

                return [
                    'content' => 'AI service temporarily unavailable. Please try again.',
                    'tool_calls' => [],
                    'tokens' => 0,
                    'finish_reason' => 'error',
                ];
            }

            $data = $response->json();
            $choice = $data['choices'][0]['message'] ?? [];
            $tokens = ($data['usage']['total_tokens'] ?? 0);

            return [
                'content' => $choice['content'] ?? null,
                'tool_calls' => $choice['tool_calls'] ?? [],
                'tokens' => $tokens,
                'finish_reason' => $data['choices'][0]['finish_reason'] ?? 'stop',
            ];
        } catch (\Throwable $e) {
            Log::error('OpenAI request failed', ['error' => $e->getMessage()]);

            return [
                'content' => 'AI service request failed. Please try again later.',
                'tool_calls' => [],
                'tokens' => 0,
                'finish_reason' => 'error',
            ];
        }
    }
}
