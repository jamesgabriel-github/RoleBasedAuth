<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\CreateAdminRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;

class AdminAccountController extends Controller
{
    public function index(): JsonResponse
    {
        $admins = User::whereIn('role', [UserRole::Admin, UserRole::SuperAdmin])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['admins' => UserResource::collection($admins)]);
    }

    public function store(CreateAdminRequest $request): JsonResponse
    {
        $role = UserRole::from($request->string('role')->value());

        $user = User::create([
            'first_name' => $request->string('first_name'),
            'middle_name' => $request->string('middle_name')->value() ?: null,
            'last_name' => $request->string('last_name'),
            'contact_number' => $request->string('contact_number')->value() ?: null,
            'email' => $request->string('email'),
            'password' => Hash::make($request->string('password')),
            'role' => $role,
            'is_active' => true,
            'email_verified_at' => now(),
        ]);

        $user->assignRole($role->value);

        return response()->json(['admin' => new UserResource($user)], 201);
    }
}
