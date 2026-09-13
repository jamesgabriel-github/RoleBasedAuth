<?php

namespace App\Http\Resources;

use App\Enums\MessageType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Conversation */
class ConversationResource extends JsonResource
{
    /**
     * @param \App\Models\Conversation $resource
     */
    public function __construct($resource, protected ?int $viewerId = null)
    {
        parent::__construct($resource);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $viewerId = $this->viewerId ?? $request->user()->id;
        $otherUser = $this->otherParticipant($viewerId);

        return [
            'id' => $this->id,
            'otherUser' => new UserResource($otherUser),
            'lastMessage' => $this->lastMessage ? [
                'body' => $this->lastMessage->body,
                'senderId' => $this->lastMessage->sender_id,
                'type' => $this->lastMessage->type->value,
                'call' => $this->lastMessage->type === MessageType::CallLog
                    && $this->lastMessage->relationLoaded('call')
                    && $this->lastMessage->call
                    ? [
                        'id' => $this->lastMessage->call->id,
                        'status' => $this->lastMessage->call->status->value,
                        'callerId' => $this->lastMessage->call->caller_id,
                        'calleeId' => $this->lastMessage->call->callee_id,
                        'durationSeconds' => $this->lastMessage->call->duration_seconds,
                    ]
                    : null,
                'createdAt' => $this->lastMessage->created_at,
            ] : null,
            'unreadCount' => (int) ($this->unread_count ?? $this->countUnreadFor($viewerId)),
            'updatedAt' => $this->last_message_at ?? $this->created_at,
        ];
    }

    private function countUnreadFor(int $viewerId): int
    {
        $lastReadAt = $this->participants->firstWhere('user_id', $viewerId)?->last_read_at;

        return $this->messages()
            ->where('sender_id', '!=', $viewerId)
            ->when($lastReadAt, fn ($query) => $query->where('created_at', '>', $lastReadAt))
            ->count();
    }
}
