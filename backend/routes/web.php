<?php

use App\Http\Controllers\Api\Auth\SocialiteController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::get('{provider}/redirect', [SocialiteController::class, 'redirect'])
        ->whereIn('provider', ['google', 'facebook', 'github']);

    Route::get('{provider}/callback', [SocialiteController::class, 'callback'])
        ->whereIn('provider', ['google', 'facebook', 'github']);
});
