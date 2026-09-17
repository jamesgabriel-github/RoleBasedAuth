export interface NewsItem {
  id: number
  title: string
  abstract: string | null
  url: string
  imageUrl: string | null
  byline: string | null
  section: string | null
  publishedAt: string | null
}
