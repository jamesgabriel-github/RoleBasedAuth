import { PhoneCall } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/AuthContext'
import type { User } from '@/types/user'
import { useCallContext } from '../CallContext'
import { canVideoCall } from '../utils'

export function CallButton({ conversationId, otherUser }: { conversationId: number; otherUser: User }) {
  const { user } = useAuth()
  const { phase, startCall } = useCallContext()

  if (!user || !canVideoCall(user.role, otherUser.role)) return null

  return (
    <Button
      variant="outline"
      size="icon"
      disabled={phase !== 'idle'}
      onClick={() => startCall(conversationId, otherUser)}
      aria-label={`Start video call with ${otherUser.fullName}`}
    >
      <PhoneCall />
    </Button>
  )
}
