import type { CallStatus } from '@/features/videoCall/types'
import type { User } from '@/types/user'

export type MessageKind = 'text' | 'call_log'

export interface CallLogSummary {
  id: number
  status: CallStatus
  callerId: number
  calleeId: number
  durationSeconds: number | null
}

export interface TextMessage {
  id: number
  conversationId: number
  senderId: number
  sender?: User
  type: 'text'
  body: string
  call?: null
  createdAt: string
}

export interface CallMessage {
  id: number
  conversationId: number
  senderId: number
  sender?: User
  type: 'call_log'
  body: null
  call: CallLogSummary
  createdAt: string
}

export type Message = TextMessage | CallMessage

export interface ConversationSummary {
  id: number
  otherUser: User
  lastMessage: {
    body: string | null
    senderId: number
    type: MessageKind
    call: CallLogSummary | null
    createdAt: string
  } | null
  unreadCount: number
  updatedAt: string
}

export interface PaginatedMessages {
  data: Message[]
  hasMore: boolean
}
