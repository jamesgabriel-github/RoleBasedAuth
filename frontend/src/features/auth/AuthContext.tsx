import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ensureCsrfCookie } from '@/lib/api-client'
import { connectEcho, disconnectEcho } from '@/lib/echo'
import type { User } from '@/types/user'
import * as authApi from './api'
import type { LoginPayload, RegisterPayload } from './types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (payload: LoginPayload) => Promise<User>
  register: (payload: RegisterPayload) => Promise<User>
  logout: () => Promise<void>
  refetch: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const bootstrap = useCallback(async () => {
    try {
      await ensureCsrfCookie()
      const me = await authApi.fetchMe()
      setUser(me)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  useEffect(() => {
    if (user) {
      connectEcho()
    } else {
      disconnectEcho()
    }
  }, [user])

  const login = useCallback(async (payload: LoginPayload) => {
    const loggedInUser = await authApi.login(payload)
    setUser(loggedInUser)
    return loggedInUser
  }, [])

  const register = useCallback(async (payload: RegisterPayload) => {
    const { user: newUser } = await authApi.register(payload)
    setUser(newUser)
    return newUser
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    setUser(null)
  }, [])

  const refetch = useCallback(async () => {
    try {
      const me = await authApi.fetchMe()
      setUser(me)
    } catch {
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refetch }),
    [user, loading, login, register, logout, refetch],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
