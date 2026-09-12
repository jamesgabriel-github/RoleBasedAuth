export type Role = 'client' | 'admin' | 'super_admin'

export interface User {
  id: number
  firstName: string
  middleName: string | null
  lastName: string
  fullName: string
  contactNumber: string | null
  email: string
  role: Role
  isActive: boolean
  permissions: string[]
  createdAt: string
}
