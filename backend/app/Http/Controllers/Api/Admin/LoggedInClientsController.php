<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class LoggedInClientsController extends Controller
{
    public function index(): JsonResponse
    {
        $cutoff = now()->subMinutes((int) config('session.lifetime'))->getTimestamp();

        $activeUserIds = DB::table('sessions')
            ->whereNotNull('user_id')
            ->where('last_activity', '>=', $cutoff)
            ->pluck('user_id')
            ->unique();

        $clients = User::whereIn('id', $activeUserIds)
            ->where('role', UserRole::Client)
            ->where('is_active', true)
            ->get();

        return response()->json(['clients' => UserResource::collection($clients)]);
    }
}
