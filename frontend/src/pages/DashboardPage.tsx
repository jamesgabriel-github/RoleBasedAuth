import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/features/auth/AuthContext'
import { LoggedInClientsTable } from '@/features/admin/components/LoggedInClientsTable'
import { DashboardShell } from '@/features/dashboard/components/DashboardShell'
import { ROLE_LABELS } from '@/features/dashboard/roleLabels'
import { RequirePermission } from '@/routes/RequirePermission'

export function DashboardPage() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Welcome back, {user.firstName}</h1>
          <p className="text-sm text-muted-foreground">
            You're signed in as {ROLE_LABELS[user.role]}.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Role</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{ROLE_LABELS[user.role]}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Account status
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {user.isActive ? 'Active' : 'Disabled'}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Permissions
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {user.permissions.length}
            </CardContent>
          </Card>
        </div>

        <RequirePermission permission="view-logged-in-clients">
          <LoggedInClientsTable />
        </RequirePermission>
      </div>
    </DashboardShell>
  )
}
