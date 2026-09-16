<?php

use App\Http\Controllers\Api\Admin\AdminAccountController;
use App\Http\Controllers\Api\Admin\LoggedInClientsController;
use App\Http\Controllers\Api\Admin\UserStatusController;
use App\Http\Controllers\Api\Auth\DesktopTokenController;
use App\Http\Controllers\Api\Auth\LoginController;
use App\Http\Controllers\Api\Auth\RegisterController;
use App\Http\Controllers\Api\Auth\UserController;
use App\Http\Controllers\Api\Calling\CallController;
use App\Http\Controllers\Api\Messaging\ConversationController;
use App\Http\Controllers\Api\Messaging\MessageController;
use App\Http\Controllers\Api\Messaging\ReadReceiptController;
use App\Http\Controllers\Api\Messaging\UserSearchController;
use Illuminate\Support\Facades\Route;

Route::post('/register', [RegisterController::class, 'store']);
Route::post('/login', [LoginController::class, 'store']);

Route::middleware(['auth:sanctum', 'account.active'])->group(function () {
    Route::get('/user', [UserController::class, 'me']);
    Route::post('/logout', [LoginController::class, 'destroy']);
    Route::post('/desktop-token', [DesktopTokenController::class, 'store']);

    Route::middleware('permission:view-logged-in-clients')
        ->get('/admin/clients/logged-in', [LoggedInClientsController::class, 'index']);

    Route::middleware('permission:enable-disable-client')
        ->patch('/admin/clients/{user}/status', [UserStatusController::class, 'updateClientStatus']);

    Route::middleware('role:super_admin')->group(function () {
        Route::get('/admin/accounts', [AdminAccountController::class, 'index']);
        Route::post('/admin/accounts', [AdminAccountController::class, 'store']);
    });

    Route::middleware('permission:enable-disable-admin')
        ->patch('/admin/admins/{user}/status', [UserStatusController::class, 'updateAdminStatus']);

    Route::get('/messaging/users/search', [UserSearchController::class, 'index']);

    Route::get('/conversations', [ConversationController::class, 'index']);
    Route::post('/conversations', [ConversationController::class, 'store']);
    Route::get('/conversations/{conversation}/messages', [MessageController::class, 'index']);
    Route::post('/conversations/{conversation}/messages', [MessageController::class, 'store']);
    Route::patch('/conversations/{conversation}/read', [ReadReceiptController::class, 'update']);

    Route::post('/conversations/{conversation}/calls', [CallController::class, 'store']);
    Route::post('/calls/{call}/accept', [CallController::class, 'accept']);
    Route::post('/calls/{call}/decline', [CallController::class, 'decline']);
    Route::post('/calls/{call}/cancel', [CallController::class, 'cancel']);
    Route::post('/calls/{call}/end', [CallController::class, 'end']);
    Route::post('/calls/{call}/timeout', [CallController::class, 'timeout']);
});
