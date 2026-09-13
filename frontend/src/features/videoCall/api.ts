import { apiClient, ensureCsrfCookie } from '@/lib/api-client'
import type { Call } from './types'

export async function initiateCall(conversationId: number): Promise<Call> {
  await ensureCsrfCookie()
  const { data } = await apiClient.post<{ call: Call }>(`/api/conversations/${conversationId}/calls`)
  return data.call
}

export async function acceptCall(callId: number): Promise<Call> {
  await ensureCsrfCookie()
  const { data } = await apiClient.post<{ call: Call }>(`/api/calls/${callId}/accept`)
  return data.call
}

export async function declineCall(callId: number): Promise<Call> {
  await ensureCsrfCookie()
  const { data } = await apiClient.post<{ call: Call }>(`/api/calls/${callId}/decline`)
  return data.call
}

export async function cancelCall(callId: number): Promise<Call> {
  await ensureCsrfCookie()
  const { data } = await apiClient.post<{ call: Call }>(`/api/calls/${callId}/cancel`)
  return data.call
}

export async function timeoutCall(callId: number): Promise<Call> {
  await ensureCsrfCookie()
  const { data } = await apiClient.post<{ call: Call }>(`/api/calls/${callId}/timeout`)
  return data.call
}

export async function endCall(callId: number, outcome: 'ended' | 'failed' = 'ended'): Promise<Call> {
  await ensureCsrfCookie()
  const { data } = await apiClient.post<{ call: Call }>(`/api/calls/${callId}/end`, { outcome })
  return data.call
}
