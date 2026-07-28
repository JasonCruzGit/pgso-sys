<?php

return [
    'max_attachment_size_kb' => (int) env('MESSAGING_MAX_ATTACHMENT_KB', 10240),
    'allowed_mime_types' => [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
    ],
    'poll_interval_seconds' => (int) env('MESSAGING_POLL_INTERVAL', 15),
    'online_ttl_minutes' => (int) env('MESSAGING_ONLINE_TTL_MINUTES', 3),
    'typing_ttl_seconds' => 5,
    'messages_per_page' => 30,
    'conversations_per_page' => 20,
];
