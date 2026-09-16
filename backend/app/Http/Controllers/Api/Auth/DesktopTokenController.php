<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DesktopTokenController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        return response()->json([
            'token' => $request->user()->createToken('desktop-app')->plainTextToken,
        ]);
    }
}
