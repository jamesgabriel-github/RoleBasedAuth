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
}

export type OAuthProvider = 'google' | 'facebook' | 'github'
