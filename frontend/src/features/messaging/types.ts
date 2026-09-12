import type { User } from '@/types/user'

export interface Message {
  id: number
  conversationId: number
  senderId: number
  sender?: User
  body: string
  createdAt: string
}

export interface ConversationSummary {
  id: number
  otherUser: User
  lastMessage: { body: string; senderId: number; createdAt: string } | null
  unreadCount: number
  updatedAt: string
}

export interface PaginatedMessages {
  data: Message[]
  meta: { current_page: number; last_page: number }
}
