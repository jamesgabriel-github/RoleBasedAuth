import type { ConversationSummary } from './types'

const AVATAR_PALETTE = [
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-700',
  'bg-rose-100 text-rose-700',
] as const

export function getAvatarColorClasses(id: number): string {
  return AVATAR_PALETTE[id % AVATAR_PALETTE.length]
}

export function formatConversationTimestamp(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayDiff = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000)

  if (dayDiff === 0) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (dayDiff === 1) return 'Yesterday'
  if (dayDiff > 1 && dayDiff < 7) return date.toLocaleDateString('en-US', { weekday: 'short' })
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function filterConversations(
  conversations: ConversationSummary[],
  query: string,
): ConversationSummary[] {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return conversations
  return conversations.filter(
    (conversation) =>
      conversation.otherUser.fullName.toLowerCase().includes(trimmed) ||
      (conversation.lastMessage?.body.toLowerCase().includes(trimmed) ?? false),
  )
}
