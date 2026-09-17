<?php

namespace App\Http\Resources;

use App\Models\NewsItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin NewsItem */
class NewsItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'abstract' => $this->abstract,
            'url' => $this->url,
            'imageUrl' => $this->image_url,
            'byline' => $this->byline,
            'section' => $this->section,
            'publishedAt' => $this->published_at,
        ];
    }
}
