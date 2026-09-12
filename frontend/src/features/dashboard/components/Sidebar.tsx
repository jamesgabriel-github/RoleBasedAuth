import { NavLink } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/features/auth/AuthContext'
import { useMessagingContext } from '@/features/messaging/MessagingContext'
import { cn } from '@/lib/utils'
import type { Role } from '@/types/user'

const links: { to: string; label: string; end?: boolean; roles?: Role[] }[] = [
  { to: '/dashboard', label: 'Overview', end: true },
  { to: '/messages', label: 'Messages' },
  { to: '/admin/accounts', label: 'Admin accounts', roles: ['super_admin'] },
]

export function Sidebar() {
  const { user } = useAuth()
  const { unreadTotal } = useMessagingContext()

  return (
    <aside className="hidden w-56 shrink-0 border-r p-4 md:block">
      <p className="mb-4 px-2 text-lg font-semibold">Auth SPA</p>
      <nav className="flex flex-col gap-1">
        {links
          .filter((link) => !link.roles || (user && link.roles.includes(user.role)))
          .map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent',
                  isActive && 'bg-accent font-medium',
                )
              }
            >
              <span>{link.label}</span>
              {link.to === '/messages' && unreadTotal > 0 && <Badge>{unreadTotal}</Badge>}
            </NavLink>
          ))}
      </nav>
    </aside>
  )
}
