<?php

namespace App\Http\Controllers\Api\Messaging;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\SearchMessageableUsersRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class UserSearchController extends Controller
{
    public function index(SearchMessageableUsersRequest $request): JsonResponse
    {
        $currentUser = $request->user();
        $email = $request->string('email')->toString();

        $query = User::query()
            ->where('id', '!=', $currentUser->id)
            ->where('is_active', true)
            ->whereRaw('email ILIKE ?', ['%'.$email.'%']);

        if ($currentUser->isClient()) {
            $query->where('role', UserRole::Client);
        }

        $users = $query->orderBy('email')->take(10)->get();

        return response()->json(['users' => UserResource::collection($users)]);
    }
}
