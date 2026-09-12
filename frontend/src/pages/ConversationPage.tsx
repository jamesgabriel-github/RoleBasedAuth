import { useOutletContext, useParams } from 'react-router-dom'
import { MessageThread } from '@/features/messaging/components/MessageThread'
import type { ConversationSummary } from '@/features/messaging/types'

interface MessagesOutletContext {
  conversations: ConversationSummary[]
  upsertConversation: (conversation: ConversationSummary) => void
}

export function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const { conversations, upsertConversation } = useOutletContext<MessagesOutletContext>()

  const found = conversations.find((item) => item.id === Number(conversationId))

  if (!found) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading conversation…
      </div>
    )
  }

  const conversation: ConversationSummary = found

  function handleRead() {
    upsertConversation({ ...conversation, unreadCount: 0 })
  }

  return (
    <MessageThread
      key={conversation.id}
      conversationId={conversation.id}
      otherUser={conversation.otherUser}
      onRead={handleRead}
    />
  )
}
