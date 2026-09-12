import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import { getErrorMessage } from '@/lib/errors'
import { listConversations } from '../api'
import type { ConversationSummary } from '../types'
import { useUserChannel } from './useUserChannel'

export function useConversations() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      setConversations(await listConversations())
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load conversations.'))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      load()
    } else {
      setConversations([])
    }
  }, [user, load])

  const upsertConversation = useCallback((updated: ConversationSummary) => {
    setConversations((current) => {
      const withoutUpdated = current.filter((conversation) => conversation.id !== updated.id)
      return [updated, ...withoutUpdated].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
    })
  }, [])

  useUserChannel(user?.id ?? null, upsertConversation)

  const unreadTotal = conversations.reduce((total, conversation) => total + conversation.unreadCount, 0)

  return { conversations, loading, error, reload: load, upsertConversation, unreadTotal }
}
