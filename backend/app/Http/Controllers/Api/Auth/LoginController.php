<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;
use Laravel\Sanctum\PersonalAccessToken;

class LoginController extends Controller
{
    public function store(LoginRequest $request): JsonResponse
    {
        $credentials = $request->only('email', 'password');

        if (! Auth::attempt($credentials, remember: false)) {
            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        $user = Auth::user();

        if (! $user->is_active) {
            Auth::logout();

            throw ValidationException::withMessages([
                'email' => 'Your account has been disabled.',
            ]);
        }

        $isFrontend = EnsureFrontendRequestsAreStateful::fromFrontend($request);

        $response = ['user' => new UserResource($user)];

        if ($isFrontend) {
            // Browser SPA: no session middleware runs for non-frontend requests,
            // so this must stay behind the same check that scopes token issuance.
            $request->session()->regenerate();
        } else {
            // Non-browser clients (e.g. the desktop app) have no cookie jar/CSRF
            // context, so they authenticate with a Bearer token instead.
            $response['token'] = $user->createToken('desktop-app')->plainTextToken;
        }

        return response()->json($response);
    }

    public function destroy(Request $request): JsonResponse
    {
        $token = $request->user()?->currentAccessToken();

        if ($token instanceof PersonalAccessToken) {
            $token->delete();

            return response()->json(['message' => 'Logged out.']);
        }

        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Logged out.']);
    }
}
