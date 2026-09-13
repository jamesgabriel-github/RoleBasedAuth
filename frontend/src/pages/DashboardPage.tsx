import { Clock, Shield, User } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/features/auth/AuthContext'
import { LoggedInClientsTable } from '@/features/admin/components/LoggedInClientsTable'
import { DashboardShell } from '@/features/dashboard/components/DashboardShell'
import { StatCard } from '@/features/dashboard/components/StatCard'
import { ROLE_LABELS } from '@/features/dashboard/roleLabels'
import { formatMemberSince, formatTenure, getGreeting } from '@/features/dashboard/utils'
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
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Your account at a glance
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Here's a quick summary of your account status, role, and details.
            </p>
          </div>
          <Button asChild>
            <Link to="/messages">Go to messages</Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={Shield}
            iconClassName="bg-emerald-100 text-emerald-600"
            label="Account status"
            value={user.isActive ? 'Active' : 'Disabled'}
            caption={user.isActive ? 'No action needed' : 'Contact an administrator'}
          />
          <StatCard
            icon={User}
            iconClassName="bg-violet-100 text-violet-600"
            label="Account permission"
            value={ROLE_LABELS[user.role]}
            caption={`${user.permissions.length} permission${user.permissions.length === 1 ? '' : 's'} granted`}
          />
          <StatCard
            icon={Clock}
            iconClassName="bg-amber-100 text-amber-600"
            label="Member since"
            value={formatMemberSince(user.createdAt)}
            caption={formatTenure(user.createdAt)}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <InfoRow label="Full name" value={user.fullName} />
            <InfoRow label="Email address" value={user.email} />
            <InfoRow label="Phone number" value={user.contactNumber ?? 'Not provided'} />
          </CardContent>
        </Card>

        <RequirePermission permission="view-logged-in-clients">
          <LoggedInClientsTable />
        </RequirePermission>
      </div>
    </DashboardShell>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}
