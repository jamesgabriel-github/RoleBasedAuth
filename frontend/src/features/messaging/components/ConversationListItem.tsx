import { ChevronRight } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ROLE_LABELS } from '@/features/dashboard/roleLabels'
import { formatCallLogLabel } from '@/features/videoCall/utils'
import { cn } from '@/lib/utils'
import type { ConversationSummary } from '../types'
import { formatConversationTimestamp, getAvatarColorClasses } from '../utils'

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function previewText(conversation: ConversationSummary): string {
  const { lastMessage } = conversation
  if (!lastMessage) return 'No messages yet'
  if (lastMessage.type === 'call_log' && lastMessage.call) {
    return formatCallLogLabel(lastMessage.call.status, lastMessage.call.durationSeconds)
  }
  return lastMessage.body ?? 'No messages yet'
}

export function ConversationListItem({ conversation }: { conversation: ConversationSummary }) {
  const timestamp = formatConversationTimestamp(
    conversation.lastMessage?.createdAt ?? conversation.updatedAt,
  )

  return (
    <NavLink
      to={`/messages/${conversation.id}`}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent',
          isActive && 'bg-accent',
        )
      }
    >
      <Avatar>
        <AvatarFallback className={getAvatarColorClasses(conversation.otherUser.id)}>
          {initials(conversation.otherUser.fullName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-1 flex-col overflow-hidden">
        <span className="truncate font-medium">{conversation.otherUser.fullName}</span>
        <span className="truncate text-xs text-muted-foreground">
          {ROLE_LABELS[conversation.otherUser.role]}
        </span>
        <span className="truncate text-xs text-muted-foreground">{previewText(conversation)}</span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="text-xs text-muted-foreground">{timestamp}</span>
        <div className="flex items-center gap-1">
          {conversation.unreadCount > 0 && (
            <span className="size-2 rounded-full bg-emerald-500" aria-label="Unread" />
          )}
          <ChevronRight className="size-4 text-muted-foreground" />
        </div>
      </div>
    </NavLink>
  )
}
