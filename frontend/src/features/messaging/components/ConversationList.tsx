import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import type { User } from '@/types/user'
import { getOrCreateConversation } from '../api'
import type { ConversationSummary } from '../types'
import { filterConversations } from '../utils'
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
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => filterConversations(conversations, query), [conversations, query])

  async function handleSelectUser(user: User) {
    const conversation = await getOrCreateConversation(user.id)
    onConversationStarted(conversation)
    navigate(`/messages/${conversation.id}`)
  }

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-r">
      <div className="flex flex-col gap-1 border-b p-4">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Your inbox
        </p>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Messages</h2>
          <UserSearchCombobox onSelect={handleSelectUser} />
        </div>
        <p className="text-xs text-muted-foreground">Chat with your team and clients.</p>
      </div>
      <div className="flex flex-col gap-2 border-b p-3">
        <p className="text-sm font-medium">Recent conversations ({filtered.length})</p>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search conversations…"
            className="pl-8"
          />
        </div>
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
        ) : filtered.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">No conversations match "{query}".</p>
        ) : (
          filtered.map((conversation) => (
            <ConversationListItem key={conversation.id} conversation={conversation} />
          ))
        )}
      </div>
    </div>
  )
}
