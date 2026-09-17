<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\UploadAvatarRequest;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class UserAvatarController extends Controller
{
    public function store(UploadAvatarRequest $request): JsonResponse
    {
        $user = $request->user();
        $disk = config('filesystems.avatar_disk');

        if ($user->avatar_path) {
            Storage::disk($disk)->delete($user->avatar_path);
        }

        $path = $request->file('avatar')->store('avatars', $disk);

        $user->update(['avatar_path' => $path]);

        return response()->json(['user' => new UserResource($user)]);
    }

    public function destroy(Request $request): JsonResponse
    {
        $user = $request->user();
        $disk = config('filesystems.avatar_disk');

        if ($user->avatar_path) {
            Storage::disk($disk)->delete($user->avatar_path);
            $user->update(['avatar_path' => null]);
        }

        return response()->json(['user' => new UserResource($user)]);
    }
}
