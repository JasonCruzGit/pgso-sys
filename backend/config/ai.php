<?php

return [
    'openai' => [
        'api_key' => env('OPENAI_API_KEY'),
        'model' => env('OPENAI_MODEL', 'gpt-4o-mini'),
        'max_tokens' => (int) env('OPENAI_MAX_TOKENS', 2048),
        'timeout' => (int) env('OPENAI_TIMEOUT', 30),
    ],

    'rate_limit' => [
        'chat' => (int) env('AI_RATE_LIMIT_CHAT', 20),
        'analytics' => (int) env('AI_RATE_LIMIT_ANALYTICS', 60),
    ],

    'cache_ttl' => (int) env('AI_CACHE_TTL', 300),
];
