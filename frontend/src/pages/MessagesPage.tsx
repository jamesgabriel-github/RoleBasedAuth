import { Outlet, useMatch } from 'react-router-dom'
import { DashboardShell } from '@/features/dashboard/components/DashboardShell'
import { ConversationList } from '@/features/messaging/components/ConversationList'
import { useMessagingContext } from '@/features/messaging/MessagingContext'
import { cn } from '@/lib/utils'

export function MessagesPage() {
  const { conversations, loading, error, upsertConversation } = useMessagingContext()
  const hasSelectedConversation = Boolean(useMatch('/messages/:conversationId'))

  return (
    <DashboardShell>
      <div className="flex h-[calc(100vh-4rem-3rem)] overflow-hidden rounded-lg border">
        <ConversationList
          conversations={conversations}
          loading={loading}
          error={error}
          onConversationStarted={upsertConversation}
          className={cn(hasSelectedConversation && 'hidden md:flex')}
        />
        <div
          className={cn(
            'min-h-0 flex-1 flex-col',
            hasSelectedConversation ? 'flex' : 'hidden md:flex',
          )}
        >
          <Outlet context={{ conversations, upsertConversation }} />
        </div>
      </div>
    </DashboardShell>
  )
}

export function MessagesEmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
      Select a conversation or start a new one.
    </div>
  )
}
