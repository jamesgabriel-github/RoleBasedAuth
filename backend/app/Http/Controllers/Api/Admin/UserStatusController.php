<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UserStatusController extends Controller
{
    public function updateClientStatus(Request $request, User $user): JsonResponse
    {
        abort_unless($user->role === UserRole::Client, 404);

        $isActive = (bool) $request->boolean('is_active');

        $this->applyStatus($user, $isActive);

        return response()->json(['user' => new UserResource($user->fresh())]);
    }

    public function updateAdminStatus(Request $request, User $user): JsonResponse
    {
        abort_unless(in_array($user->role, [UserRole::Admin, UserRole::SuperAdmin], true), 404);

        $isActive = (bool) $request->boolean('is_active');

        if ($user->is($request->user())) {
            throw ValidationException::withMessages([
                'is_active' => 'You cannot disable your own account.',
            ]);
        }

        if (! $isActive && $user->role === UserRole::SuperAdmin) {
            $otherActiveSuperAdmins = User::where('role', UserRole::SuperAdmin)
                ->where('is_active', true)
                ->where('id', '!=', $user->id)
                ->exists();

            if (! $otherActiveSuperAdmins) {
                throw ValidationException::withMessages([
                    'is_active' => 'At least one active super admin must remain.',
                ]);
            }
        }

        $this->applyStatus($user, $isActive);

        return response()->json(['user' => new UserResource($user->fresh())]);
    }

    private function applyStatus(User $user, bool $isActive): void
    {
        DB::transaction(function () use ($user, $isActive) {
            $user->update(['is_active' => $isActive]);

            if (! $isActive) {
                DB::table('sessions')->where('user_id', $user->id)->delete();
                $user->tokens()->delete();
            }
        });
    }
}
