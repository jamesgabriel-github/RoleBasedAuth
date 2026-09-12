import { cn } from '@/lib/utils'
import type { Message } from '../types'

export function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  return (
    <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[70%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words',
          isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted',
        )}
      >
        {message.body}
      </div>
    </div>
  )
}
