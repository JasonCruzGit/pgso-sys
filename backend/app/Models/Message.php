<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Crypt;

class Message extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'conversation_id', 'sender_id', 'body', 'body_preview', 'reply_to_id', 'is_edited', 'edited_at',
    ];

    protected function casts(): array
    {
        return [
            'is_edited' => 'boolean',
            'edited_at' => 'datetime',
        ];
    }

    public function setBodyAttribute(?string $value): void
    {
        $this->attributes['body'] = $value !== null && $value !== ''
            ? Crypt::encryptString($value)
            : Crypt::encryptString('');
    }

    public function getBodyAttribute(?string $value): string
    {
        if ($value === null || $value === '') {
            return $this->attributes['body_preview'] ?? '';
        }

        try {
            return Crypt::decryptString($value);
        } catch (\Throwable) {
            return $this->attributes['body_preview'] ?? $value;
        }
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function replyTo(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'reply_to_id');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(MessageAttachment::class);
    }

    public function reactions(): HasMany
    {
        return $this->hasMany(MessageReaction::class);
    }

    public function reads(): HasMany
    {
        return $this->hasMany(MessageRead::class);
    }
}
