import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'

const ERROR_MESSAGES: Record<string, string> = {
  email_exists: 'An account with that email already exists. Please log in with your original method instead.',
  account_disabled: 'This account has been disabled. Contact an administrator.',
  oauth_failed: 'We could not complete sign-in with that provider. Please try again.',
  email_missing:
    "We couldn't get an email address from that provider. Please make sure your account has a public email, or sign in with a different method.",
}

export function OAuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const { refetch } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const ranOnce = useRef(false)

  useEffect(() => {
    if (ranOnce.current) return
    ranOnce.current = true

    const errorCode = searchParams.get('error')

    if (errorCode) {
      setError(ERROR_MESSAGES[errorCode] ?? 'Sign-in failed. Please try again.')
      return
    }

    refetch().then(() => navigate('/dashboard', { replace: true }))
  }, [searchParams, refetch, navigate])

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="max-w-md text-sm text-destructive">{error}</p>
        <button
          type="button"
          className="text-sm underline"
          onClick={() => navigate('/login', { replace: true })}
        >
          Back to login
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Signing you in…
    </div>
  )
}
