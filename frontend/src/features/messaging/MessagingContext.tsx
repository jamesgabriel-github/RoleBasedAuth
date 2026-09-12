import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { useConversations } from './hooks/useConversations'

type MessagingContextValue = ReturnType<typeof useConversations>

const MessagingContext = createContext<MessagingContextValue | null>(null)

export function MessagingProvider({ children }: { children: ReactNode }) {
  const value = useConversations()
  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>
}

export function useMessagingContext(): MessagingContextValue {
  const context = useContext(MessagingContext)
  if (!context) {
    throw new Error('useMessagingContext must be used within a MessagingProvider')
  }
  return context
}
