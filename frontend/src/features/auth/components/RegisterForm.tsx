import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getErrorMessage } from '@/lib/errors'
import { useAuth } from '../AuthContext'
import * as authApi from '../api'

const initialState = {
  first_name: '',
  middle_name: '',
  last_name: '',
  contact_number: '',
  email: '',
  password: '',
  password_confirmation: '',
}

export function RegisterForm() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState(initialState)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [desktopMessage, setDesktopMessage] = useState<string | null>(null)

  const isDesktop = searchParams.get('source') === 'desktop'
  const callbackPort = searchParams.get('callback_port')
  const state = searchParams.get('state')

  function update<K extends keyof typeof initialState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (isDesktop) {
        // Opened by the desktop app for sign-up: register without touching
        // AuthContext's user state, so PublicOnlyRoute never redirects this tab
        // to /dashboard — the account is meant to be used on desktop, not here.
        const { token } = await authApi.register({ ...form, source: 'desktop' })

        if (token && callbackPort && state) {
          fetch(
            `http://127.0.0.1:${callbackPort}/callback?token=${encodeURIComponent(token)}&state=${encodeURIComponent(state)}`,
            { mode: 'no-cors' },
          ).catch(() => {
            // Fire-and-forget: the desktop app may have closed mid-flow. The
            // account still exists either way, so there's nothing to surface.
          })
          setDesktopMessage("You're signed in on the desktop app — you can close this tab.")
        } else {
          setDesktopMessage('Account created — you can close this tab and log in from the desktop app.')
        }
      } else {
        await register(form)
        navigate('/dashboard')
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to register.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (desktopMessage) {
    return <p className="text-sm text-muted-foreground">{desktopMessage}</p>
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="register-first-name">First name</Label>
          <Input
            id="register-first-name"
            required
            value={form.first_name}
            onChange={(e) => update('first_name', e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="register-middle-name">Middle name</Label>
          <Input
            id="register-middle-name"
            value={form.middle_name}
            onChange={(e) => update('middle_name', e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="register-last-name">Last name</Label>
        <Input
          id="register-last-name"
          required
          value={form.last_name}
          onChange={(e) => update('last_name', e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="register-contact-number">Contact number</Label>
        <Input
          id="register-contact-number"
          required
          value={form.contact_number}
          onChange={(e) => update('contact_number', e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="register-email">Email</Label>
        <Input
          id="register-email"
          type="email"
          required
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          autoComplete="email"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="register-password">Password</Label>
          <Input
            id="register-password"
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="register-password-confirmation">Confirm password</Label>
          <Input
            id="register-password-confirmation"
            type="password"
            required
            minLength={8}
            value={form.password_confirmation}
            onChange={(e) => update('password_confirmation', e.target.value)}
            autoComplete="new-password"
          />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  )
}
