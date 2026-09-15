import { useEffect, useRef } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuth } from '@/features/auth/AuthContext'
import { CallButton } from '@/features/videoCall/components/CallButton'
import type { User } from '@/types/user'
import { markConversationRead, sendMessage } from '../api'
import { useMessages } from '../hooks/useMessages'
import { CallLogMessage } from './CallLogMessage'
import { MessageBubble } from './MessageBubble'
import { MessageComposer } from './MessageComposer'

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function MessageThread({
  conversationId,
  otherUser,
  onRead,
}: {
  conversationId: number
  otherUser: User
  onRead: () => void
}) {
  const { user } = useAuth()
  const { messages, loading, appendMessage } = useMessages(conversationId)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    markConversationRead(conversationId)
      .then(onRead)
      .catch((error) => {
        console.error('Failed to mark conversation as read', error)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  async function handleSend(body: string) {
    const message = await sendMessage(conversationId, body)
    appendMessage(message)
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b p-3">
        <Avatar>
          <AvatarFallback>{initials(otherUser.fullName)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-sm font-medium">{otherUser.fullName}</span>
          <span className="text-xs text-muted-foreground">{otherUser.email}</span>
        </div>
        <div className="ml-auto">
          <CallButton conversationId={conversationId} otherUser={otherUser} />
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((message) =>
              message.type === 'call_log' ? (
                <CallLogMessage key={message.id} message={message} />
              ) : (
                <MessageBubble key={message.id} message={message} isOwn={message.senderId === user?.id} />
              ),
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      <MessageComposer onSend={handleSend} />
    </div>
  )
}
