import { apiClient, ensureCsrfCookie } from '@/lib/api-client'
import type { User } from '@/types/user'
import type { LoginPayload, OAuthProvider, RegisterPayload } from './types'

export async function fetchMe(): Promise<User> {
  const { data } = await apiClient.get<{ user: User }>('/api/user')
  return data.user
}

export async function login(payload: LoginPayload): Promise<User> {
  await ensureCsrfCookie()
  const { data } = await apiClient.post<{ user: User }>('/api/login', payload)
  return data.user
}

export async function register(payload: RegisterPayload): Promise<User> {
  await ensureCsrfCookie()
  const { data } = await apiClient.post<{ user: User }>('/api/register', payload)
  return data.user
}

export async function logout(): Promise<void> {
  await ensureCsrfCookie()
  await apiClient.post('/api/logout')
}

export function oauthRedirectUrl(provider: OAuthProvider): string {
  return `${import.meta.env.VITE_API_URL}/auth/${provider}/redirect`
}
