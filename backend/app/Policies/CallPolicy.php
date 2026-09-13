<?php

namespace App\Policies;

use App\Enums\CallStatus;
use App\Models\Call;
use App\Models\Conversation;
use App\Models\User;

class CallPolicy
{
    public function view(User $user, Call $call): bool
    {
        return $call->isParticipant($user->id);
    }

    public function initiate(User $user, Conversation $conversation): bool
    {
        if (! $conversation->isParticipant($user->id)) {
            return false;
        }

        return $user->role->canVideoCallWith($conversation->otherParticipant($user->id)->role);
    }

    public function accept(User $user, Call $call): bool
    {
        return $call->callee_id === $user->id && $call->status === CallStatus::Ringing;
    }

    public function decline(User $user, Call $call): bool
    {
        return $this->accept($user, $call);
    }

    public function cancel(User $user, Call $call): bool
    {
        return $call->caller_id === $user->id && $call->status === CallStatus::Ringing;
    }

    public function timeout(User $user, Call $call): bool
    {
        return $call->isParticipant($user->id) && $call->status === CallStatus::Ringing;
    }

    public function end(User $user, Call $call): bool
    {
        return $call->isParticipant($user->id) && $call->status === CallStatus::Ongoing;
    }
}
