<?php

namespace App\Console\Commands;

use App\Models\NewsItem;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FetchNytTopStories extends Command
{
    protected $signature = 'news:fetch-nyt';

    protected $description = 'Fetch the latest NYT Top Stories and store them in the news_items table';

    private const KEEP = 200;

    public function handle(): int
    {
        $apiKey = config('services.nytimes.api_key');

        if (! $apiKey) {
            $this->warn('NYT_API_KEY is not configured; skipping news fetch.');

            return self::FAILURE;
        }

        $section = config('services.nytimes.section', 'home');

        $response = Http::get("https://api.nytimes.com/svc/topstories/v2/{$section}.json", [
            'api-key' => $apiKey,
        ]);

        if ($response->failed()) {
            Log::error('NYT Top Stories request failed.', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            $this->error("NYT request failed with status {$response->status()}.");

            return self::FAILURE;
        }

        $results = $response->json('results', []);

        foreach ($results as $result) {
            $externalId = $result['uri'] ?? $result['url'] ?? null;

            if (! $externalId || empty($result['title']) || empty($result['url'])) {
                continue;
            }

            NewsItem::updateOrCreate(
                ['external_id' => $externalId],
                [
                    'source' => 'nytimes',
                    'section' => $result['section'] ?? $section,
                    'title' => $result['title'],
                    'abstract' => $result['abstract'] ?? null,
                    'url' => $result['url'],
                    'image_url' => collect($result['multimedia'] ?? [])->first()['url'] ?? null,
                    'byline' => $result['byline'] ?? null,
                    'published_at' => $result['published_date'] ?? null,
                ]
            );
        }

        $staleIds = NewsItem::where('source', 'nytimes')
            ->orderByDesc('published_at')
            ->pluck('id')
            ->slice(self::KEEP)
            ->all();

        if ($staleIds !== []) {
            NewsItem::destroy($staleIds);
        }

        $this->info(sprintf('Fetched %d NYT top stories.', count($results)));

        return self::SUCCESS;
    }
}
