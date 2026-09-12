import { useEffect, useRef } from 'react'
import { connectEcho } from '@/lib/echo'
import type { Message } from '../types'

export function useConversationChannel(
  conversationId: number | null,
  onMessage: (message: Message) => void,
) {
  const onMessageRef = useRef(onMessage)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    if (!conversationId) return

    const channelName = `conversation.${conversationId}`
    const handler = (message: Message) => onMessageRef.current(message)

    connectEcho().then((echo) => {
      echo.private(channelName).listen('.message.sent', handler)
    })

    return () => {
      connectEcho().then((echo) => echo.leave(channelName))
    }
  }, [conversationId])
}
