import type { Role } from '@/types/user'
import type { CallStatus } from './types'

/**
 * Video calls are only allowed client-to-client, or between staff
 * (admin/super_admin, in any combination) — mirrors UserRole::canVideoCallWith
 * on the backend. This is UI-only; the server is the real enforcement point.
 */
export function canVideoCall(a: Role, b: Role): boolean {
  if (a === 'client' && b === 'client') return true
  const staff: Role[] = ['admin', 'super_admin']
  return staff.includes(a) && staff.includes(b)
}

export function formatCallDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function formatCallLogLabel(status: CallStatus, durationSeconds: number | null): string {
  switch (status) {
    case 'ended':
      return `Video call · ${formatCallDuration(durationSeconds ?? 0)}`
    case 'missed':
      return 'Missed video call'
    case 'declined':
      return 'Declined video call'
    case 'cancelled':
      return 'Cancelled video call'
    case 'failed':
      return 'Call failed'
    default:
      return 'Video call'
  }
}

// STUN-only for now — no TURN server. Calls behind symmetric NAT or strict
// corporate firewalls may fail to connect; that's an accepted limitation.
export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
}

export const CALL_RING_TIMEOUT_MS = 45_000
