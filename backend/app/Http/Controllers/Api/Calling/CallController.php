<?php

namespace App\Http\Controllers\Api\Calling;

use App\Enums\CallStatus;
use App\Enums\MessageType;
use App\Events\CallInvited;
use App\Events\CallStatusChanged;
use App\Events\ConversationUpdated;
use App\Events\MessageSent;
use App\Http\Controllers\Controller;
use App\Http\Requests\EndCallRequest;
use App\Http\Resources\CallResource;
use App\Models\Call;
use App\Models\Conversation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class CallController extends Controller
{
    public function store(Request $request, Conversation $conversation): JsonResponse
    {
        Gate::authorize('view', $conversation);
        Gate::authorize('initiate', [Call::class, $conversation]);

        $callerId = $request->user()->id;
        $calleeId = $conversation->otherParticipant($callerId)->id;

        $call = DB::transaction(function () use ($conversation, $callerId, $calleeId) {
            $busy = Call::query()
                ->whereIn('status', [CallStatus::Ringing->value, CallStatus::Ongoing->value])
                ->where(fn ($query) => $query->whereIn('caller_id', [$callerId, $calleeId])
                    ->orWhereIn('callee_id', [$callerId, $calleeId]))
                ->lockForUpdate()
                ->exists();

            abort_if($busy, 409, 'One of the participants is already on a call.');

            return Call::create([
                'conversation_id' => $conversation->id,
                'caller_id' => $callerId,
                'callee_id' => $calleeId,
                'status' => CallStatus::Ringing,
            ]);
        });

        $call->load(['caller', 'callee']);

        broadcast(new CallInvited($call));

        return response()->json(['call' => new CallResource($call)], 201);
    }

    public function accept(Call $call): JsonResponse
    {
        Gate::authorize('accept', $call);

        $call->update(['status' => CallStatus::Ongoing, 'answered_at' => now()]);
        $call->load(['caller', 'callee']);

        broadcast(new CallStatusChanged($call));

        return response()->json(['call' => new CallResource($call)]);
    }

    public function decline(Request $request, Call $call): JsonResponse
    {
        Gate::authorize('decline', $call);

        $this->terminal($request, $call, CallStatus::Declined);

        return response()->json(['call' => new CallResource($call->fresh(['caller', 'callee']))]);
    }

    public function cancel(Request $request, Call $call): JsonResponse
    {
        Gate::authorize('cancel', $call);

        $this->terminal($request, $call, CallStatus::Cancelled);

        return response()->json(['call' => new CallResource($call->fresh(['caller', 'callee']))]);
    }

    public function timeout(Request $request, Call $call): JsonResponse
    {
        Gate::authorize('timeout', $call);

        $this->terminal($request, $call, CallStatus::Missed);

        return response()->json(['call' => new CallResource($call->fresh(['caller', 'callee']))]);
    }

    public function end(EndCallRequest $request, Call $call): JsonResponse
    {
        Gate::authorize('end', $call);

        $status = CallStatus::from($request->input('outcome', 'ended'));

        $this->terminal($request, $call, $status);

        return response()->json(['call' => new CallResource($call->fresh(['caller', 'callee']))]);
    }

    private function terminal(Request $request, Call $call, CallStatus $status): void
    {
        DB::transaction(function () use ($request, $call, $status) {
            $endedAt = now();

            $call->update([
                'status' => $status,
                'ended_at' => $endedAt,
                'duration_seconds' => $call->answered_at
                    ? (int) round($call->answered_at->diffInSeconds($endedAt, absolute: true))
                    : null,
            ]);

            $conversation = $call->conversation;

            $message = $conversation->messages()->create([
                'sender_id' => $request->user()->id,
                'type' => MessageType::CallLog,
                'call_id' => $call->id,
                'body' => null,
            ]);

            $conversation->update([
                'last_message_id' => $message->id,
                'last_message_at' => $message->created_at,
            ]);

            $recipientId = $conversation->otherParticipant($request->user()->id)->id;

            broadcast(new MessageSent($message));
            broadcast(new ConversationUpdated($conversation, $recipientId));
        });

        broadcast(new CallStatusChanged($call->load(['caller', 'callee'])));
    }
}
