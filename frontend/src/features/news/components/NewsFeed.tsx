import { Newspaper } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/errors'
import { listNews } from '../api'
import type { NewsItem } from '../types'

const REFRESH_INTERVAL_MS = 5 * 60 * 1000

function NewsCardSkeleton() {
  return (
    <Card className="pt-0">
      <Skeleton className="aspect-video w-full rounded-none" />
      <CardHeader>
        <Skeleton className="h-4 w-3/4" />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </CardContent>
    </Card>
  )
}

export function NewsFeed() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pageRef = useRef(0)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return
    loadingRef.current = true
    setLoadingMore(true)
    try {
      const nextPage = pageRef.current + 1
      const result = await listNews(nextPage)
      pageRef.current = nextPage
      hasMoreRef.current = result.hasMore
      setItems((prev) => (nextPage === 1 ? result.items : [...prev, ...result.items]))
      setError(null)
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load news right now.'))
      hasMoreRef.current = false
    } finally {
      loadingRef.current = false
      setLoadingMore(false)
      setLoadingInitial(false)
    }
  }, [])

  const reset = useCallback(() => {
    pageRef.current = 0
    hasMoreRef.current = true
    setItems([])
    setLoadingInitial(true)
    loadMore()
  }, [loadMore])

  useEffect(() => {
    reset()
    const interval = setInterval(reset, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [reset])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore()
    }, { rootMargin: '200px' })

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Latest headlines</h2>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loadingInitial ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <NewsCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No news available right now.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer">
                <Card className="h-full pt-0 transition-shadow hover:shadow-md">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="aspect-video w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center bg-muted">
                      <Newspaper className="size-8 text-muted-foreground" />
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="line-clamp-2">{item.title}</CardTitle>
                  </CardHeader>
                  {item.abstract && (
                    <CardContent>
                      <p className="line-clamp-3 text-sm text-muted-foreground">{item.abstract}</p>
                    </CardContent>
                  )}
                </Card>
              </a>
            ))}
          </div>

          {loadingMore && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <NewsCardSkeleton key={i} />
              ))}
            </div>
          )}
        </>
      )}

      <div ref={sentinelRef} className="h-px" />
    </div>
  )
}
