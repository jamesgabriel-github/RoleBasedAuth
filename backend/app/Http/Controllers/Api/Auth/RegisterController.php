<?php

namespace App\Http\Controllers\Api\Auth;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class RegisterController extends Controller
{
    public function store(RegisterRequest $request): JsonResponse
    {
        $user = User::create([
            'first_name' => $request->string('first_name'),
            'middle_name' => $request->string('middle_name')->value() ?: null,
            'last_name' => $request->string('last_name'),
            'contact_number' => $request->string('contact_number'),
            'email' => $request->string('email'),
            'password' => Hash::make($request->string('password')),
            'role' => UserRole::Client,
            'is_active' => true,
        ]);

        $user->assignRole(UserRole::Client->value);

        $response = ['user' => new UserResource($user)];

        if ($request->input('source') === 'desktop') {
            // Opened by the desktop app's system-browser registration flow — it
            // authenticates with a Bearer token, not a session cookie, and we
            // deliberately skip Auth::login() so this browser tab doesn't end up
            // with its own logged-in SPA session for an account meant for desktop.
            $response['token'] = $user->createToken('desktop-app')->plainTextToken;
        } else {
            Auth::login($user);
            $request->session()->regenerate();
        }

        return response()->json($response, 201);
    }
}
