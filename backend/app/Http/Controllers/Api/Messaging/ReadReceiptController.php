<?php

namespace App\Http\Controllers\Api\Messaging;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ReadReceiptController extends Controller
{
    public function update(Request $request, Conversation $conversation): JsonResponse
    {
        Gate::authorize('view', $conversation);

        $readAt = now();

        $conversation->participants()
            ->where('user_id', $request->user()->id)
            ->update(['last_read_at' => $readAt]);

        return response()->json(['readAt' => $readAt]);
    }
}
