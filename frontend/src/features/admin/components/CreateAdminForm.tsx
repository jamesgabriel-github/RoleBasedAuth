import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getErrorMessage } from '@/lib/errors'
import type { Role } from '@/types/user'
import { createAdmin } from '../api'

const initialState = {
  first_name: '',
  middle_name: '',
  last_name: '',
  contact_number: '',
  email: '',
  password: '',
  password_confirmation: '',
  role: 'admin' as Extract<Role, 'admin' | 'super_admin'>,
}

export function CreateAdminForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState(initialState)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function update<K extends keyof typeof initialState>(key: K, value: (typeof initialState)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await createAdmin(form)
      setForm(initialState)
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to create account.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="admin-first-name">First name</Label>
          <Input
            id="admin-first-name"
            required
            value={form.first_name}
            onChange={(e) => update('first_name', e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="admin-last-name">Last name</Label>
          <Input
            id="admin-last-name"
            required
            value={form.last_name}
            onChange={(e) => update('last_name', e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="admin-email">Email</Label>
        <Input
          id="admin-email"
          type="email"
          required
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="admin-password">Password</Label>
          <Input
            id="admin-password"
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="admin-password-confirmation">Confirm password</Label>
          <Input
            id="admin-password-confirmation"
            type="password"
            required
            minLength={8}
            value={form.password_confirmation}
            onChange={(e) => update('password_confirmation', e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="admin-role">Role</Label>
        <select
          id="admin-role"
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
          value={form.role}
          onChange={(e) => update('role', e.target.value as (typeof initialState)['role'])}
        >
          <option value="admin">Admin</option>
          <option value="super_admin">Super Admin</option>
        </select>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={submitting} className="w-fit">
        {submitting ? 'Creating…' : 'Create account'}
      </Button>
    </form>
  )
}
