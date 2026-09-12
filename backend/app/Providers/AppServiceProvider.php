<?php

namespace App\Providers;

use App\Enums\UserRole;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::before(function (User $user, string $ability, array $arguments = []) {
            if (($arguments[0] ?? null) instanceof Conversation) {
                // Conversations are strictly participant-only, even for super_admin —
                // always defer to ConversationPolicy instead of bypassing.
                return null;
            }

            return $user->role === UserRole::SuperAdmin ? true : null;
        });
    }
}
