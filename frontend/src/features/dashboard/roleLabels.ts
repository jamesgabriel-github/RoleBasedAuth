import type { Role } from '@/types/user'

export const ROLE_LABELS: Record<Role, string> = {
  client: 'Client',
  admin: 'Admin',
  super_admin: 'Super Admin',
}
