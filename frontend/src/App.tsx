import { RouterProvider } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/features/auth/AuthContext'
import { MessagingProvider } from '@/features/messaging/MessagingContext'
import { CallProvider } from '@/features/videoCall/CallContext'
import { CallWindow } from '@/features/videoCall/components/CallWindow'
import { IncomingCallModal } from '@/features/videoCall/components/IncomingCallModal'
import { router } from '@/routes/router'

export default function App() {
  return (
    <AuthProvider>
      <MessagingProvider>
        <CallProvider>
          <RouterProvider router={router} />
          <IncomingCallModal />
          <CallWindow />
          <Toaster />
        </CallProvider>
      </MessagingProvider>
    </AuthProvider>
  )
}
