import type { User } from '@/types/user'

export type CallStatus = 'ringing' | 'ongoing' | 'declined' | 'missed' | 'cancelled' | 'ended' | 'failed'

export interface Call {
  id: number
  conversationId: number
  status: CallStatus
  caller: User
  callee: User
  callerId: number
  calleeId: number
  answeredAt: string | null
  endedAt: string | null
  durationSeconds: number | null
  createdAt: string
}

export type SignalPayload =
  | { type: 'offer'; sdp: RTCSessionDescriptionInit; fromUserId: number }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit; fromUserId: number }
  | { type: 'ice-candidate'; candidate: RTCIceCandidateInit; fromUserId: number }
