import { apiClient, ensureCsrfCookie } from '@/lib/api-client'
import type { User } from '@/types/user'
import type { LoginPayload, OAuthProvider, RegisterPayload, RegisterResult } from './types'

export async function fetchMe(): Promise<User> {
  const { data } = await apiClient.get<{ user: User }>('/api/user')
  return data.user
}

export async function login(payload: LoginPayload): Promise<User> {
  await ensureCsrfCookie()
  const { data } = await apiClient.post<{ user: User }>('/api/login', payload)
  return data.user
}

export async function register(payload: RegisterPayload): Promise<RegisterResult> {
  await ensureCsrfCookie()
  const { data } = await apiClient.post<RegisterResult>('/api/register', payload)
  return data
}

export async function logout(): Promise<void> {
  await ensureCsrfCookie()
  await apiClient.post('/api/logout')
}

export function oauthRedirectUrl(provider: OAuthProvider): string {
  return `${import.meta.env.VITE_API_URL}/auth/${provider}/redirect`
}

export async function uploadAvatar(file: File): Promise<User> {
  await ensureCsrfCookie()
  const formData = new FormData()
  formData.append('avatar', file)
  const { data } = await apiClient.post<{ user: User }>('/api/user/avatar', formData)
  return data.user
}

export async function removeAvatar(): Promise<User> {
  await ensureCsrfCookie()
  const { data } = await apiClient.delete<{ user: User }>('/api/user/avatar')
  return data.user
}
