<?php

namespace App\Http\Controllers\Api\Auth;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Laravel\Socialite\Contracts\User as SocialiteUser;
use Laravel\Socialite\Facades\Socialite;
use Throwable;

class SocialiteController extends Controller
{
    private const PROVIDERS = ['google', 'facebook', 'github'];

    public function redirect(string $provider): RedirectResponse
    {
        $this->guardProvider($provider);

        return Socialite::driver($provider)->redirect();
    }

    public function callback(Request $request, string $provider): RedirectResponse
    {
        $this->guardProvider($provider);

        $frontendUrl = config('app.frontend_url');

        try {
            $socialUser = Socialite::driver($provider)->user();
        } catch (Throwable) {
            return redirect()->away("{$frontendUrl}/oauth/callback?error=oauth_failed&provider={$provider}");
        }

        $existingLink = SocialAccount::where('provider', $provider)
            ->where('provider_user_id', $socialUser->getId())
            ->first();

        if ($existingLink) {
            $user = $existingLink->user;

            if (! $user->is_active) {
                return redirect()->away("{$frontendUrl}/oauth/callback?error=account_disabled&provider={$provider}");
            }

            return $this->logInAndRedirect($request, $user, $frontendUrl);
        }

        // Only reachable for a first-time sign-in with this provider, where we have no
        // provider_user_id link yet and must identify/create the user by email instead.
        if (! $socialUser->getEmail()) {
            return redirect()->away("{$frontendUrl}/oauth/callback?error=email_missing&provider={$provider}");
        }

        $existingUser = User::where('email', $socialUser->getEmail())->first();

        if ($existingUser) {
            return redirect()->away("{$frontendUrl}/oauth/callback?error=email_exists&provider={$provider}");
        }

        $user = $this->createUserFromSocialite($provider, $socialUser);

        return $this->logInAndRedirect($request, $user, $frontendUrl);
    }

    private function guardProvider(string $provider): void
    {
        abort_unless(in_array($provider, self::PROVIDERS, true), 404);
    }

    private function createUserFromSocialite(string $provider, SocialiteUser $socialUser): User
    {
        $name = $socialUser->getName() ?: $socialUser->getNickname() ?: 'New User';
        [$firstName, $lastName] = $this->splitName($name);

        $user = User::create([
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $socialUser->getEmail(),
            'password' => null,
            'role' => UserRole::Client,
            'is_active' => true,
            'email_verified_at' => now(),
        ]);

        $user->assignRole(UserRole::Client->value);

        $user->socialAccounts()->create([
            'provider' => $provider,
            'provider_user_id' => $socialUser->getId(),
            'avatar_url' => $socialUser->getAvatar(),
        ]);

        return $user;
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function splitName(string $name): array
    {
        $parts = Str::of($name)->trim()->explode(' ')->filter()->values();

        if ($parts->count() === 1) {
            return [$parts->first(), ''];
        }

        return [$parts->first(), $parts->slice(1)->implode(' ')];
    }

    private function logInAndRedirect(Request $request, User $user, string $frontendUrl): RedirectResponse
    {
        Auth::login($user);
        $request->session()->regenerate();

        return redirect()->away("{$frontendUrl}/oauth/callback");
    }
}
