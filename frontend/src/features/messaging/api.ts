import { apiClient, ensureCsrfCookie } from '@/lib/api-client'
import type { User } from '@/types/user'
import type { ConversationSummary, Message, PaginatedMessages } from './types'

export async function searchMessageableUsers(email: string): Promise<User[]> {
  const { data } = await apiClient.get<{ users: User[] }>('/api/messaging/users/search', {
    params: { email },
  })
  return data.users
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const { data } = await apiClient.get<{ conversations: ConversationSummary[] }>('/api/conversations')
  return data.conversations
}

export async function getOrCreateConversation(userId: number): Promise<ConversationSummary> {
  await ensureCsrfCookie()
  const { data } = await apiClient.post<{ conversation: ConversationSummary }>('/api/conversations', {
    user_id: userId,
  })
  return data.conversation
}

export async function listMessages(conversationId: number, page = 1): Promise<PaginatedMessages> {
  const { data } = await apiClient.get<{ messages: PaginatedMessages }>(
    `/api/conversations/${conversationId}/messages`,
    { params: { page } },
  )
  return data.messages
}

export async function sendMessage(conversationId: number, body: string): Promise<Message> {
  await ensureCsrfCookie()
  const { data } = await apiClient.post<{ message: Message }>(
    `/api/conversations/${conversationId}/messages`,
    { body },
  )
  return data.message
}

export async function markConversationRead(conversationId: number): Promise<void> {
  await ensureCsrfCookie()
  await apiClient.patch(`/api/conversations/${conversationId}/read`)
}
