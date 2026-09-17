import type { LucideIcon } from 'lucide-react'
import { LayoutGrid, MessageCircle, ShieldCheck, Users, UserRound } from 'lucide-react'
import type { Role } from '@/types/user'

export interface DashboardNavLink {
  to: string
  label: string
  end?: boolean
  roles?: Role[]
  icon: LucideIcon
}

export const dashboardNavLinks: DashboardNavLink[] = [
  { to: '/dashboard', label: 'Overview', end: true, icon: LayoutGrid },
  { to: '/profile', label: 'Profile', icon: UserRound },
  { to: '/messages', label: 'Messages', icon: MessageCircle },
  { to: '/admin/clients', label: 'Manage clients', roles: ['admin', 'super_admin'], icon: Users },
  { to: '/admin/accounts', label: 'Admin accounts', roles: ['super_admin'], icon: ShieldCheck },
]
