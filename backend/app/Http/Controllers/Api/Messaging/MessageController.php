<?php

namespace App\Http\Controllers\Api\Messaging;

use App\Enums\MessageType;
use App\Events\ConversationUpdated;
use App\Events\MessageSent;
use App\Http\Controllers\Controller;
use App\Http\Requests\SendMessageRequest;
use App\Http\Resources\MessageResource;
use App\Models\Conversation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class MessageController extends Controller
{
    public function index(Request $request, Conversation $conversation): JsonResponse
    {
        Gate::authorize('view', $conversation);

        $perPage = 30;
        $before = $request->integer('before');

        $query = $conversation->messages()
            ->with(['sender', 'call'])
            ->orderByDesc('id');

        if ($before) {
            $query->where('id', '<', $before);
        }

        $messages = $query->limit($perPage + 1)->get();
        $hasMore = $messages->count() > $perPage;
        $messages = $messages->take($perPage);

        return response()->json([
            'messages' => [
                'data' => MessageResource::collection($messages),
                'hasMore' => $hasMore,
            ],
        ]);
    }

    public function store(SendMessageRequest $request, Conversation $conversation): JsonResponse
    {
        Gate::authorize('send', $conversation);

        $sender = $request->user();
        $body = $request->string('body')->toString();

        $message = DB::transaction(function () use ($conversation, $sender, $body) {
            $message = $conversation->messages()->create([
                'sender_id' => $sender->id,
                'type' => MessageType::Text,
                'body' => $body,
            ]);

            $conversation->update([
                'last_message_id' => $message->id,
                'last_message_at' => $message->created_at,
            ]);

            return $message;
        });

        $recipientId = $conversation->otherParticipant($sender->id)->id;

        broadcast(new MessageSent($message))->toOthers();
        broadcast(new ConversationUpdated($conversation, $recipientId));

        return response()->json(['message' => new MessageResource($message->load('sender'))], 201);
    }
}
