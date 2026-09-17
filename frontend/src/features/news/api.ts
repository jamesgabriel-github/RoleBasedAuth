import { apiClient } from '@/lib/api-client'
import type { NewsItem } from './types'

export interface NewsPage {
  items: NewsItem[]
  hasMore: boolean
}

export async function listNews(page: number): Promise<NewsPage> {
  const { data } = await apiClient.get<NewsPage>('/api/news', { params: { page } })
  return data
}
