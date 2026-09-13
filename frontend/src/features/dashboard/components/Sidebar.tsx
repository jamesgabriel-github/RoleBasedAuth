import type { LucideIcon } from 'lucide-react'
import { LayoutGrid, MessageCircle, ShieldCheck } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/features/auth/AuthContext'
import { useMessagingContext } from '@/features/messaging/MessagingContext'
import { cn } from '@/lib/utils'
import type { Role } from '@/types/user'

const links: { to: string; label: string; end?: boolean; roles?: Role[]; icon: LucideIcon }[] = [
  { to: '/dashboard', label: 'Overview', end: true, icon: LayoutGrid },
  { to: '/messages', label: 'Messages', icon: MessageCircle },
  { to: '/admin/accounts', label: 'Admin accounts', roles: ['super_admin'], icon: ShieldCheck },
]

export function Sidebar() {
  const { user } = useAuth()
  const { unreadTotal } = useMessagingContext()

  return (
    <aside className="hidden w-56 shrink-0 border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground md:block">
      <p className="mb-2 px-2 text-xs font-semibold tracking-wide text-sidebar-foreground/60 uppercase">
        Workspace
      </p>
      <nav className="flex flex-col gap-1">
        {links
          .filter((link) => !link.roles || (user && link.roles.includes(user.role)))
          .map(({ to, label, end, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent',
                  isActive && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
                )
              }
            >
              <span className="flex items-center gap-2">
                <Icon className="size-4" />
                {label}
              </span>
              {to === '/messages' && unreadTotal > 0 && <Badge>{unreadTotal}</Badge>}
            </NavLink>
          ))}
      </nav>
    </aside>
  )
}
