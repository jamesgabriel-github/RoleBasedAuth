<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['source', 'external_id', 'section', 'title', 'abstract', 'url', 'image_url', 'byline', 'published_at'])]
class NewsItem extends Model
{
    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
        ];
    }
}
