import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function StatCard({
  icon: Icon,
  iconClassName,
  label,
  value,
  caption,
}: {
  icon: LucideIcon
  iconClassName: string
  label: string
  value: string
  caption: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className={cn('flex size-9 items-center justify-center rounded-lg', iconClassName)}>
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground">{caption}</p>
        </div>
      </CardContent>
    </Card>
  )
}
