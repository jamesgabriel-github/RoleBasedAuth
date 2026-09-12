import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/features/auth/AuthContext'
import { ROLE_LABELS } from '@/features/dashboard/roleLabels'
import type { User } from '@/types/user'

export function AdminAccountsTable({
  admins,
  onToggleStatus,
  pendingId,
}: {
  admins: User[]
  onToggleStatus: (admin: User) => void
  pendingId: number | null
}) {
  const { user: currentUser } = useAuth()

  if (admins.length === 0) {
    return <p className="text-sm text-muted-foreground">No admin accounts yet.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead className="w-28">Status</TableHead>
          <TableHead className="w-32 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {admins.map((admin) => (
          <TableRow key={admin.id}>
            <TableCell>{admin.fullName}</TableCell>
            <TableCell>{admin.email}</TableCell>
            <TableCell>{ROLE_LABELS[admin.role]}</TableCell>
            <TableCell>
              <Badge variant={admin.isActive ? 'secondary' : 'outline'}>
                {admin.isActive ? 'Active' : 'Disabled'}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant={admin.isActive ? 'destructive' : 'outline'}
                size="sm"
                disabled={pendingId === admin.id || admin.id === currentUser?.id}
                onClick={() => onToggleStatus(admin)}
              >
                {admin.isActive ? 'Disable' : 'Enable'}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
