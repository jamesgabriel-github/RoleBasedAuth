import { Outlet } from 'react-router-dom'
import { DashboardShell } from '@/features/dashboard/components/DashboardShell'
import { ConversationList } from '@/features/messaging/components/ConversationList'
import { useMessagingContext } from '@/features/messaging/MessagingContext'

export function MessagesPage() {
  const { conversations, loading, error, upsertConversation } = useMessagingContext()

  return (
    <DashboardShell>
      <div className="flex h-[calc(100vh-4rem-3rem)] overflow-hidden rounded-lg border">
        <ConversationList
          conversations={conversations}
          loading={loading}
          error={error}
          onConversationStarted={upsertConversation}
        />
        <Outlet context={{ conversations, upsertConversation }} />
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
