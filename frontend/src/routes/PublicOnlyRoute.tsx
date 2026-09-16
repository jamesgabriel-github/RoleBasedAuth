import type { ReactNode } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'

const DESKTOP_HANDOFF_KEYS = ['source', 'callback_port', 'state']

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const [searchParams] = useSearchParams()

  if (loading) return null
  if (user) {
    // Forward only these three keys so /dashboard doesn't inherit arbitrary
    // params from wherever the user was redirected from.
    const desktop = new URLSearchParams()
    for (const key of DESKTOP_HANDOFF_KEYS) {
      const value = searchParams.get(key)
      if (value) desktop.set(key, value)
    }
    const suffix = desktop.toString() ? `?${desktop}` : ''
    return <Navigate to={`/dashboard${suffix}`} replace />
  }

  return <>{children}</>
}
