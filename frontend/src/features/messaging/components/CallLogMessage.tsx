import { PhoneMissed, Video } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCallLogLabel } from '@/features/videoCall/utils'
import type { CallMessage } from '../types'

export function CallLogMessage({ message }: { message: CallMessage }) {
  const { status, durationSeconds } = message.call
  const label = formatCallLogLabel(status, durationSeconds)
  const wasUnsuccessful = status !== 'ended'

  return (
    <div className="flex justify-center py-1">
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground',
        )}
      >
        {wasUnsuccessful ? <PhoneMissed className="size-3.5" /> : <Video className="size-3.5" />}
        {label}
      </div>
    </div>
  )
}
