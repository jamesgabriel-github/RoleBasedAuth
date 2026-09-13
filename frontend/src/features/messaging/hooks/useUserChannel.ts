import { useEffect, useRef } from 'react'
import { subscribeUserChannel } from '@/lib/userChannel'
import type { ConversationSummary } from '../types'

export function useUserChannel(
  userId: number | null,
  onConversationUpdated: (conversation: ConversationSummary) => void,
) {
  const onConversationUpdatedRef = useRef(onConversationUpdated)

  useEffect(() => {
    onConversationUpdatedRef.current = onConversationUpdated
  }, [onConversationUpdated])

  useEffect(() => {
    if (!userId) return

    let cleanup: (() => void) | undefined
    let cancelled = false

    subscribeUserChannel(userId, (channel) => {
      const handler = (conversation: ConversationSummary) => onConversationUpdatedRef.current(conversation)
      channel.listen('.conversation.updated', handler)
      return () => channel.stopListening('.conversation.updated', handler)
    }).then((unsubscribe) => {
      if (cancelled) {
        unsubscribe()
      } else {
        cleanup = unsubscribe
      }
    })

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [userId])
}
