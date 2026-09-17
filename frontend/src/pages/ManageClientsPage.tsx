import { LoggedInClientsTable } from '@/features/admin/components/LoggedInClientsTable'
import { DashboardShell } from '@/features/dashboard/components/DashboardShell'

export function ManageClientsPage() {
  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Manage clients</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            View clients with an active session and manage their account status.
          </p>
        </div>

        <LoggedInClientsTable />
      </div>
    </DashboardShell>
  )
}
