import { RouterProvider } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/features/auth/AuthContext'
import { MessagingProvider } from '@/features/messaging/MessagingContext'
import { router } from '@/routes/router'

export default function App() {
  return (
    <AuthProvider>
      <MessagingProvider>
        <RouterProvider router={router} />
        <Toaster />
      </MessagingProvider>
    </AuthProvider>
  )
}
