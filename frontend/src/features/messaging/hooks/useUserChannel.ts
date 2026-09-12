import { useEffect, useRef } from 'react'
import { connectEcho } from '@/lib/echo'
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

    const channelName = `user.${userId}`
    const handler = (conversation: ConversationSummary) => onConversationUpdatedRef.current(conversation)

    connectEcho().then((echo) => {
      echo.private(channelName).listen('.conversation.updated', handler)
    })

    return () => {
      connectEcho().then((echo) => echo.leave(channelName))
    }
  }, [userId])
}
