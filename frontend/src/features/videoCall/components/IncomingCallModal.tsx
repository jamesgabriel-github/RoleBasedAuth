import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCallContext } from '../CallContext'

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function IncomingCallModal() {
  const { phase, call, acceptIncoming, declineIncoming } = useCallContext()

  if (phase !== 'incoming' || !call) return null

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent showCloseButton={false} className="text-center">
        <DialogHeader className="items-center">
          <Avatar size="lg">
            <AvatarFallback className="text-lg">{initials(call.caller.fullName)}</AvatarFallback>
          </Avatar>
          <DialogTitle>{call.caller.fullName}</DialogTitle>
          <DialogDescription>Incoming video call…</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center gap-3">
          <Button variant="destructive" onClick={declineIncoming}>
            Decline
          </Button>
          <Button onClick={acceptIncoming}>Accept</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
