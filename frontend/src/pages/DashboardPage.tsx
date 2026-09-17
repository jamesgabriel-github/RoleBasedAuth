import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/AuthContext'
import { LoggedInClientsTable } from '@/features/admin/components/LoggedInClientsTable'
import { DashboardShell } from '@/features/dashboard/components/DashboardShell'
import { getGreeting } from '@/features/dashboard/utils'
import { RequirePermission } from '@/routes/RequirePermission'

export function DashboardPage() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Good {getGreeting()}, {user.firstName}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Overview</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Here's what's happening across your workspace.
            </p>
          </div>
          <Button asChild>
            <Link to="/messages">Go to messages</Link>
          </Button>
        </div>

        <RequirePermission permission="view-logged-in-clients">
          <LoggedInClientsTable />
        </RequirePermission>
      </div>
    </DashboardShell>
  )
}
