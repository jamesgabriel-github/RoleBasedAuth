import { useEffect, useLayoutEffect, useRef } from 'react'
import type { UIEvent } from 'react'
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

const NEAR_EDGE_THRESHOLD_PX = 100

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
  const { messages, loading, loadingMore, hasMore, loadMore, appendMessage } = useMessages(conversationId)
  const bottomRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const prevScrollHeightRef = useRef<number | null>(null)
  const isNearBottomRef = useRef(true)
  const didInitialScrollRef = useRef(false)

  useEffect(() => {
    markConversationRead(conversationId)
      .then(onRead)
      .catch((error) => {
        console.error('Failed to mark conversation as read', error)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return

    if (prevScrollHeightRef.current != null) {
      // Older messages were just prepended — keep the previously-visible message anchored.
      el.scrollTop = el.scrollHeight - prevScrollHeightRef.current
      prevScrollHeightRef.current = null
      return
    }

    if (!didInitialScrollRef.current) {
      if (!loading && messages.length > 0) {
        bottomRef.current?.scrollIntoView({ block: 'end' })
        didInitialScrollRef.current = true
      }
      return
    }

    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ block: 'end' })
    }
  }, [messages, loading])

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const el = event.currentTarget
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_EDGE_THRESHOLD_PX

    if (el.scrollTop < NEAR_EDGE_THRESHOLD_PX && hasMore && !loadingMore) {
      prevScrollHeightRef.current = el.scrollHeight
      loadMore()
    }
  }

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

      <ScrollArea className="min-h-0 flex-1 p-4" viewportRef={viewportRef} onViewportScroll={handleScroll}>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="flex flex-col gap-2">
            {loadingMore && (
              <p className="py-2 text-center text-xs text-muted-foreground">Loading older messages…</p>
            )}
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
