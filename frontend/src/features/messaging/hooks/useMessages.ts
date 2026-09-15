import { useCallback, useEffect, useState } from 'react'
import { getErrorMessage } from '@/lib/errors'
import { listMessages } from '../api'
import type { Message } from '../types'
import { useConversationChannel } from './useConversationChannel'

export function useMessages(conversationId: number | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  const load = useCallback(async () => {
    if (!conversationId) return
    setLoading(true)
    setError(null)
    try {
      const result = await listMessages(conversationId)
      setMessages(result.data.slice().reverse())
      setHasMore(result.hasMore)
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
    if (!conversationId || !hasMore || loadingMore) return
    setLoadingMore(true)
    try {
      const oldestId = messages[0]?.id
      const result = await listMessages(conversationId, oldestId)
      setMessages((current) => [...result.data.slice().reverse(), ...current])
      setHasMore(result.hasMore)
    } finally {
      setLoadingMore(false)
    }
  }, [conversationId, hasMore, loadingMore, messages])

  const appendMessage = useCallback((message: Message) => {
    setMessages((current) =>
      current.some((existing) => existing.id === message.id) ? current : [...current, message],
    )
  }, [])

  useConversationChannel(conversationId, appendMessage)

  return { messages, loading, loadingMore, error, hasMore, loadMore, appendMessage, reload: load }
}
