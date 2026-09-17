<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('news_items', function (Blueprint $table) {
            $table->id();
            $table->string('source')->default('nytimes');
            $table->string('external_id')->unique();
            $table->string('section')->nullable();
            $table->string('title');
            $table->text('abstract')->nullable();
            $table->string('url');
            $table->string('image_url')->nullable();
            $table->string('byline')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['source', 'published_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('news_items');
    }
};
