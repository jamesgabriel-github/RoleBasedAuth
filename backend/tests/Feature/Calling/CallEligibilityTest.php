<?php

namespace Tests\Feature\Calling;

use App\Enums\UserRole;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CallEligibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_client_can_call_client(): void
    {
        [$a, , $conversation] = $this->makePair(UserRole::Client, UserRole::Client);

        $this->actingAs($a)
            ->postJson("/api/conversations/{$conversation->id}/calls")
            ->assertCreated();
    }

    public function test_admin_cannot_call_client(): void
    {
        [$admin, , $conversation] = $this->makePair(UserRole::Admin, UserRole::Client);

        $this->actingAs($admin)
            ->postJson("/api/conversations/{$conversation->id}/calls")
            ->assertForbidden();
    }

    public function test_client_cannot_call_admin(): void
    {
        [$client, , $conversation] = $this->makePair(UserRole::Client, UserRole::Admin);

        $this->actingAs($client)
            ->postJson("/api/conversations/{$conversation->id}/calls")
            ->assertForbidden();
    }

    public function test_admin_can_call_admin(): void
    {
        [$a, , $conversation] = $this->makePair(UserRole::Admin, UserRole::Admin);

        $this->actingAs($a)
            ->postJson("/api/conversations/{$conversation->id}/calls")
            ->assertCreated();
    }

    public function test_admin_can_call_super_admin(): void
    {
        [$a, , $conversation] = $this->makePair(UserRole::Admin, UserRole::SuperAdmin);

        $this->actingAs($a)
            ->postJson("/api/conversations/{$conversation->id}/calls")
            ->assertCreated();
    }

    public function test_super_admin_can_call_super_admin(): void
    {
        [$a, , $conversation] = $this->makePair(UserRole::SuperAdmin, UserRole::SuperAdmin);

        $this->actingAs($a)
            ->postJson("/api/conversations/{$conversation->id}/calls")
            ->assertCreated();
    }

    /**
     * Regression test for the Gate::before carve-out: super_admin normally
     * auto-passes every ability, but must NOT bypass the cross-tier
     * video-call restriction just because it's a super_admin.
     */
    public function test_super_admin_cannot_bypass_cross_tier_restriction(): void
    {
        [$superAdmin, , $conversation] = $this->makePair(UserRole::SuperAdmin, UserRole::Client);

        $this->actingAs($superAdmin)
            ->postJson("/api/conversations/{$conversation->id}/calls")
            ->assertForbidden();
    }

    /**
     * @return array{0: User, 1: User, 2: Conversation}
     */
    private function makePair(UserRole $roleA, UserRole $roleB): array
    {
        $a = User::factory()->create(['role' => $roleA]);
        $b = User::factory()->create(['role' => $roleB]);

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
