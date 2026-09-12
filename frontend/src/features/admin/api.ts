import { apiClient, ensureCsrfCookie } from '@/lib/api-client'
import type { Role, User } from '@/types/user'

export interface CreateAdminPayload {
  first_name: string
  middle_name?: string
  last_name: string
  contact_number?: string
  email: string
  password: string
  password_confirmation: string
  role: Extract<Role, 'admin' | 'super_admin'>
}

export async function listAdmins(): Promise<User[]> {
  const { data } = await apiClient.get<{ admins: User[] }>('/api/admin/accounts')
  return data.admins
}

export async function createAdmin(payload: CreateAdminPayload): Promise<User> {
  await ensureCsrfCookie()
  const { data } = await apiClient.post<{ admin: User }>('/api/admin/accounts', payload)
  return data.admin
}

export async function listLoggedInClients(): Promise<User[]> {
  const { data } = await apiClient.get<{ clients: User[] }>('/api/admin/clients/logged-in')
  return data.clients
}

export async function setClientStatus(userId: number, isActive: boolean): Promise<User> {
  await ensureCsrfCookie()
  const { data } = await apiClient.patch<{ user: User }>(`/api/admin/clients/${userId}/status`, {
    is_active: isActive,
  })
  return data.user
}

export async function setAdminStatus(userId: number, isActive: boolean): Promise<User> {
  await ensureCsrfCookie()
  const { data } = await apiClient.patch<{ user: User }>(`/api/admin/admins/${userId}/status`, {
    is_active: isActive,
  })
  return data.user
}
