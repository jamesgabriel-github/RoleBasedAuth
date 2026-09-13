<?php

namespace App\Models;

use App\Enums\CallStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['conversation_id', 'caller_id', 'callee_id', 'status', 'answered_at', 'ended_at', 'duration_seconds'])]
class Call extends Model
{
    protected function casts(): array
    {
        return [
            'status' => CallStatus::class,
            'answered_at' => 'datetime',
            'ended_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Conversation, $this> */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /** @return BelongsTo<User, $this> */
    public function caller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'caller_id');
    }

    /** @return BelongsTo<User, $this> */
    public function callee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'callee_id');
    }

    public function isParticipant(int $userId): bool
    {
        return $this->caller_id === $userId || $this->callee_id === $userId;
    }

    public function otherParticipant(int $userId): User
    {
        return $this->caller_id === $userId ? $this->callee : $this->caller;
    }
}
