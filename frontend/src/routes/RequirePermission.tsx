import type { ReactNode } from 'react'
import { useAuth } from '@/features/auth/AuthContext'

export function RequirePermission({
  permission,
  children,
}: {
  permission: string
  children: ReactNode
}) {
  const { user } = useAuth()

  if (!user || !user.permissions.includes(permission)) {
    return null
  }

  return <>{children}</>
}
