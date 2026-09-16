import { useEffect, useRef, useState } from 'react'
import { Navigate, Outlet, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { apiClient } from '@/lib/api-client'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const handledRef = useRef(false)
  // Captured once at mount from the URL that landed here (possibly forwarded
  // by PublicOnlyRoute). Deliberately not re-derived from `searchParams` on
  // every render: the effect below clears these same params after handling
  // them, and this flag must stay true afterward so the confirmation view
  // below doesn't flip back to rendering the dashboard underneath it.
  const [isDesktopHandoff] = useState(
    () =>
      searchParams.get('source') === 'desktop' &&
      Boolean(searchParams.get('callback_port')) &&
      Boolean(searchParams.get('state')),
  )

  useEffect(() => {
    if (!user || handledRef.current || !isDesktopHandoff) return
    const callbackPort = searchParams.get('callback_port')
    const state = searchParams.get('state')
    if (!callbackPort || !state) return

    handledRef.current = true
    apiClient.post<{ token: string }>('/api/desktop-token').then(({ data }) => {
      fetch(
        `http://127.0.0.1:${callbackPort}/callback?token=${encodeURIComponent(data.token)}&state=${encodeURIComponent(state)}`,
        { mode: 'no-cors' },
      ).catch(() => {
        // Fire-and-forget, same as RegisterForm's callback call -- the
        // desktop app may have closed mid-flow; nothing to surface here.
      })
    })

    // Drop the params so a refresh doesn't repeat the exchange/callback.
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('source')
        next.delete('callback_port')
        next.delete('state')
        return next
      },
      { replace: true },
    )
  }, [user, searchParams, setSearchParams, isDesktopHandoff])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (!user) return <Navigate to="/" replace />

  if (isDesktopHandoff) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-center">
        <p className="text-sm text-muted-foreground">
          You're signed in on the desktop app as {user.fullName} — you can close this tab.
        </p>
      </div>
    )
  }

  return <Outlet />
}
