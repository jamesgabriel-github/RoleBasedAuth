<?php

use App\Models\Call;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Gate;

Broadcast::channel('conversation.{conversationId}', function (User $user, int $conversationId) {
    $conversation = Conversation::find($conversationId);

    return $conversation ? Gate::forUser($user)->check('view', $conversation) : false;
});

Broadcast::channel('user.{userId}', function (User $user, int $userId) {
    return $user->id === $userId;
});

Broadcast::channel('call.{callId}', function (User $user, int $callId) {
    $call = Call::find($callId);

    return $call ? Gate::forUser($user)->check('view', $call) : false;
});
