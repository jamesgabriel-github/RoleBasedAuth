import { NavLink } from 'react-router-dom'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ConversationSummary } from '../types'

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function ConversationListItem({ conversation }: { conversation: ConversationSummary }) {
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
        <AvatarFallback>{initials(conversation.otherUser.fullName)}</AvatarFallback>
      </Avatar>
      <div className="flex flex-1 flex-col overflow-hidden">
        <span className="truncate font-medium">{conversation.otherUser.fullName}</span>
        <span className="truncate text-xs text-muted-foreground">
          {conversation.lastMessage?.body ?? 'No messages yet'}
        </span>
      </div>
      {conversation.unreadCount > 0 && (
        <Badge variant="default" className="shrink-0">
          {conversation.unreadCount}
        </Badge>
      )}
    </NavLink>
  )
}
