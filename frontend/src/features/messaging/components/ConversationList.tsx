import { useNavigate } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import type { User } from '@/types/user'
import { getOrCreateConversation } from '../api'
import type { ConversationSummary } from '../types'
import { ConversationListItem } from './ConversationListItem'
import { UserSearchCombobox } from './UserSearchCombobox'

export function ConversationList({
  conversations,
  loading,
  error,
  onConversationStarted,
}: {
  conversations: ConversationSummary[]
  loading: boolean
  error: string | null
  onConversationStarted: (conversation: ConversationSummary) => void
}) {
  const navigate = useNavigate()

  async function handleSelectUser(user: User) {
    const conversation = await getOrCreateConversation(user.id)
    onConversationStarted(conversation)
    navigate(`/messages/${conversation.id}`)
  }

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-r">
      <div className="flex items-center justify-between border-b p-3">
        <h2 className="text-sm font-semibold">Messages</h2>
        <UserSearchCombobox onSelect={handleSelectUser} />
      </div>
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex flex-col gap-2 p-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : error ? (
          <p className="p-2 text-sm text-destructive">{error}</p>
        ) : conversations.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">No conversations yet.</p>
        ) : (
          conversations.map((conversation) => (
            <ConversationListItem key={conversation.id} conversation={conversation} />
          ))
        )}
      </div>
    </div>
  )
}
