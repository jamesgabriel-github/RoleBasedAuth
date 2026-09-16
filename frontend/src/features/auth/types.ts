import type { User } from '@/types/user'

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  first_name: string
  middle_name?: string
  last_name: string
  contact_number: string
  email: string
  password: string
  password_confirmation: string
  /** Set when the desktop app opened this page — see WEB_APP_REGISTRATION_CHANGES.md. */
  source?: 'desktop'
}

export interface RegisterResult {
  user: User
  /** Present only when the request carried `source: 'desktop'`. */
  token?: string
}

export type OAuthProvider = 'google' | 'facebook' | 'github'
