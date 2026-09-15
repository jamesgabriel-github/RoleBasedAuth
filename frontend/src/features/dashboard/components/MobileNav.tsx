import { NavLink } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useAuth } from '@/features/auth/AuthContext'
import { useMessagingContext } from '@/features/messaging/MessagingContext'
import { cn } from '@/lib/utils'
import { dashboardNavLinks } from '../navLinks'

export function MobileNav({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user } = useAuth()
  const { unreadTotal } = useMessagingContext()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-3/4 sm:max-w-xs">
        <SheetHeader>
          <SheetTitle className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Workspace
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4">
          {dashboardNavLinks
            .filter((link) => !link.roles || (user && link.roles.includes(user.role)))
            .map(({ to, label, end, icon: Icon }) => (
              <SheetClose asChild key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-accent',
                      isActive && 'bg-accent font-medium',
                    )
                  }
                >
                  <span className="flex items-center gap-2">
                    <Icon className="size-4" />
                    {label}
                  </span>
                  {to === '/messages' && unreadTotal > 0 && <Badge>{unreadTotal}</Badge>}
                </NavLink>
              </SheetClose>
            ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
