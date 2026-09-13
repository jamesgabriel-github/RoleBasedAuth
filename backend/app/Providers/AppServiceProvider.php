<?php

namespace App\Providers;

use App\Enums\UserRole;
use App\Models\Call;
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
            // Gate::raw() passes the raw, unstripped arguments array here — for
            // abilities authorized via the [Class::class, $model] "create-style"
            // form (e.g. Call's `initiate`), the target model may sit at any
            // index, not just 0. Scan all of them rather than only $arguments[0].
            $targetsRestrictedModel = collect($arguments)->contains(
                fn ($argument) => $argument instanceof Conversation || $argument instanceof Call,
            );

            if ($targetsRestrictedModel) {
                // Conversations and calls are strictly participant-only, even for
                // super_admin — always defer to their policies instead of bypassing.
                return null;
            }

            return $user->role === UserRole::SuperAdmin ? true : null;
        });
    }
}
