<?php

namespace App\Http\Resources;

use App\Enums\MessageType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Message */
class MessageResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'conversationId' => $this->conversation_id,
            'senderId' => $this->sender_id,
            'sender' => new UserResource($this->whenLoaded('sender')),
            'type' => $this->type->value,
            'body' => $this->body,
            'call' => $this->when(
                $this->type === MessageType::CallLog && $this->relationLoaded('call') && $this->call,
                fn () => [
                    'id' => $this->call->id,
                    'status' => $this->call->status->value,
                    'callerId' => $this->call->caller_id,
                    'calleeId' => $this->call->callee_id,
                    'durationSeconds' => $this->call->duration_seconds,
                ],
            ),
            'createdAt' => $this->created_at,
        ];
    }
}
