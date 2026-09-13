<?php

namespace Tests\Feature\Calling;

use App\Enums\CallStatus;
use App\Enums\MessageType;
use App\Enums\UserRole;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CallLifecycleTest extends TestCase
{
    use RefreshDatabase;

    public function test_initiate_accept_then_end_records_duration_and_call_log(): void
    {
        [$caller, $callee, $conversation] = $this->makeClientPair();

        $call = $this->actingAs($caller)
            ->postJson("/api/conversations/{$conversation->id}/calls")
            ->assertCreated()
            ->json('call');

        $this->actingAs($callee)
            ->postJson("/api/calls/{$call['id']}/accept")
            ->assertOk()
            ->assertJsonPath('call.status', 'ongoing');

        $this->travel(65)->seconds();

        $response = $this->actingAs($caller)
            ->postJson("/api/calls/{$call['id']}/end")
            ->assertOk();

        $response->assertJsonPath('call.status', 'ended');
        $this->assertGreaterThanOrEqual(60, $response->json('call.durationSeconds'));

        $this->assertDatabaseHas('calls', ['id' => $call['id'], 'status' => CallStatus::Ended->value]);

        $logMessage = $conversation->messages()->latest('id')->first();
        $this->assertSame(MessageType::CallLog, $logMessage->type);
        $this->assertSame($call['id'], $logMessage->call_id);
        $this->assertNull($logMessage->body);

        $conversation->refresh();
        $this->assertSame($logMessage->id, $conversation->last_message_id);
    }

    public function test_decline_marks_call_declined(): void
    {
        [$caller, $callee, $conversation] = $this->makeClientPair();

        $call = $this->actingAs($caller)
            ->postJson("/api/conversations/{$conversation->id}/calls")
            ->json('call');

        $this->actingAs($callee)
            ->postJson("/api/calls/{$call['id']}/decline")
            ->assertOk()
            ->assertJsonPath('call.status', 'declined');
    }

    public function test_cancel_marks_call_cancelled(): void
    {
        [$caller, , $conversation] = $this->makeClientPair();

        $call = $this->actingAs($caller)
            ->postJson("/api/conversations/{$conversation->id}/calls")
            ->json('call');

        $this->actingAs($caller)
            ->postJson("/api/calls/{$call['id']}/cancel")
            ->assertOk()
            ->assertJsonPath('call.status', 'cancelled');
    }

    public function test_timeout_marks_call_missed(): void
    {
        [$caller, $callee, $conversation] = $this->makeClientPair();

        $call = $this->actingAs($caller)
            ->postJson("/api/conversations/{$conversation->id}/calls")
            ->json('call');

        $this->actingAs($callee)
            ->postJson("/api/calls/{$call['id']}/timeout")
            ->assertOk()
            ->assertJsonPath('call.status', 'missed');
    }

    public function test_second_initiate_while_busy_is_rejected(): void
    {
        [$caller, $callee, $conversation] = $this->makeClientPair();
        $third = User::factory()->create(['role' => UserRole::Client]);

        $this->actingAs($caller)
            ->postJson("/api/conversations/{$conversation->id}/calls")
            ->assertCreated();

        [$userOneId, $userTwoId] = $callee->id < $third->id
            ? [$callee->id, $third->id]
            : [$third->id, $callee->id];

        $otherConversation = Conversation::create(['user_one_id' => $userOneId, 'user_two_id' => $userTwoId]);
        $otherConversation->participants()->create(['user_id' => $callee->id]);
        $otherConversation->participants()->create(['user_id' => $third->id]);

        $this->actingAs($third)
            ->postJson("/api/conversations/{$otherConversation->id}/calls")
            ->assertStatus(409);
    }

    public function test_non_participant_cannot_control_call(): void
    {
        [$caller, , $conversation] = $this->makeClientPair();
        $outsider = User::factory()->create(['role' => UserRole::Client]);

        $call = $this->actingAs($caller)
            ->postJson("/api/conversations/{$conversation->id}/calls")
            ->json('call');

        $this->actingAs($outsider)
            ->postJson("/api/calls/{$call['id']}/accept")
            ->assertForbidden();
    }

    /**
     * @return array{0: User, 1: User, 2: Conversation}
     */
    private function makeClientPair(): array
    {
        $a = User::factory()->create(['role' => UserRole::Client]);
        $b = User::factory()->create(['role' => UserRole::Client]);

        [$userOneId, $userTwoId] = $a->id < $b->id ? [$a->id, $b->id] : [$b->id, $a->id];

        $conversation = Conversation::create([
            'user_one_id' => $userOneId,
            'user_two_id' => $userTwoId,
        ]);

        $conversation->participants()->create(['user_id' => $a->id]);
        $conversation->participants()->create(['user_id' => $b->id]);

        return [$a, $b, $conversation];
    }
}
