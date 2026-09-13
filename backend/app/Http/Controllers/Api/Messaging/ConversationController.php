<?php

namespace App\Http\Controllers\Api\Messaging;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\CreateConversationRequest;
use App\Http\Resources\ConversationResource;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ConversationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $conversations = Conversation::query()
            ->where(fn ($query) => $query->where('user_one_id', $userId)->orWhere('user_two_id', $userId))
            ->with(['userOne', 'userTwo', 'lastMessage.call', 'participants'])
            ->orderByDesc('last_message_at')
            ->get();

        $resources = $conversations->map(fn (Conversation $conversation) => new ConversationResource($conversation, $userId));

        return response()->json(['conversations' => $resources]);
    }

    public function store(CreateConversationRequest $request): JsonResponse
    {
        $currentUser = $request->user();
        $targetUser = User::findOrFail($request->integer('user_id'));

        abort_if($targetUser->is($currentUser), 422, 'Cannot message yourself.');

        if ($currentUser->isClient() && $targetUser->role !== UserRole::Client) {
            throw ValidationException::withMessages(['user_id' => 'You cannot message this user.']);
        }

        [$userOneId, $userTwoId] = $currentUser->id < $targetUser->id
            ? [$currentUser->id, $targetUser->id]
            : [$targetUser->id, $currentUser->id];

        $conversation = DB::transaction(function () use ($userOneId, $userTwoId) {
            $conversation = Conversation::firstOrCreate([
                'user_one_id' => $userOneId,
                'user_two_id' => $userTwoId,
            ]);

            $conversation->participants()->firstOrCreate(['user_id' => $userOneId]);
            $conversation->participants()->firstOrCreate(['user_id' => $userTwoId]);

            return $conversation;
        });

        return response()->json([
            'conversation' => new ConversationResource($conversation->load(['userOne', 'userTwo', 'lastMessage.call', 'participants'])),
        ], 201);
    }
}
