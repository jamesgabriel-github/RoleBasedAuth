<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Call */
class CallResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'conversationId' => $this->conversation_id,
            'status' => $this->status->value,
            'caller' => new UserResource($this->whenLoaded('caller')),
            'callee' => new UserResource($this->whenLoaded('callee')),
            'callerId' => $this->caller_id,
            'calleeId' => $this->callee_id,
            'answeredAt' => $this->answered_at,
            'endedAt' => $this->ended_at,
            'durationSeconds' => $this->duration_seconds,
            'createdAt' => $this->created_at,
        ];
    }
}
