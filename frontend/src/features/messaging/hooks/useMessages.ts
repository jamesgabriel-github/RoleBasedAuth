import { useCallback, useEffect, useState } from 'react'
import { getErrorMessage } from '@/lib/errors'
import { listMessages } from '../api'
import type { Message } from '../types'
import { useConversationChannel } from './useConversationChannel'

export function useMessages(conversationId: number | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const load = useCallback(async () => {
    if (!conversationId) return
    setLoading(true)
    setError(null)
    try {
      const result = await listMessages(conversationId, 1)
      setMessages(result.data.slice().reverse())
      setHasMore(result.meta.current_page < result.meta.last_page)
      setPage(1)
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load messages.'))
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    load()
  }, [load])

  const loadMore = useCallback(async () => {
    if (!conversationId || !hasMore) return
    const nextPage = page + 1
    const result = await listMessages(conversationId, nextPage)
    setMessages((current) => [...result.data.slice().reverse(), ...current])
    setHasMore(result.meta.current_page < result.meta.last_page)
    setPage(nextPage)
  }, [conversationId, hasMore, page])

  const appendMessage = useCallback((message: Message) => {
    setMessages((current) =>
      current.some((existing) => existing.id === message.id) ? current : [...current, message],
    )
  }, [])

  useConversationChannel(conversationId, appendMessage)

  return { messages, loading, error, hasMore, loadMore, appendMessage, reload: load }
}
