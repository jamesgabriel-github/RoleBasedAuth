<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->string('type')->default('text')->after('sender_id');
            $table->foreignId('call_id')->nullable()->after('type')->constrained()->nullOnDelete();
            $table->text('body')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropForeign(['call_id']);
            $table->dropColumn(['type', 'call_id']);
            $table->text('body')->nullable(false)->change();
        });
    }
};
