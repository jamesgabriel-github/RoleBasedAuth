import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AdminAccountsTable } from '@/features/admin/components/AdminAccountsTable'
import { CreateAdminForm } from '@/features/admin/components/CreateAdminForm'
import { listAdmins, setAdminStatus } from '@/features/admin/api'
import { DashboardShell } from '@/features/dashboard/components/DashboardShell'
import { getErrorMessage } from '@/lib/errors'
import type { User } from '@/types/user'

export function AdminAccountsPage() {
  const [admins, setAdmins] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setAdmins(await listAdmins())
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load admin accounts.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleToggleStatus(admin: User) {
    setPendingId(admin.id)
    setError(null)
    try {
      await setAdminStatus(admin.id, !admin.isActive)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to update account status.'))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Admin accounts</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage admin and super admin accounts.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create account</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateAdminForm onCreated={load} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Existing accounts</CardTitle>
          </CardHeader>
          <CardContent>
            {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <AdminAccountsTable
                admins={admins}
                onToggleStatus={handleToggleStatus}
                pendingId={pendingId}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}
