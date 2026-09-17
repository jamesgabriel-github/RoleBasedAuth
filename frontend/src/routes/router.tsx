import { createBrowserRouter } from 'react-router-dom'
import { AdminAccountsPage } from '@/pages/AdminAccountsPage'
import { ConversationPage } from '@/pages/ConversationPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { LoginRegisterPage } from '@/pages/LoginRegisterPage'
import { MessagesEmptyState, MessagesPage } from '@/pages/MessagesPage'
import { OAuthCallbackPage } from '@/pages/OAuthCallbackPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { PublicLandingPage } from '@/pages/PublicLandingPage'
import { ProtectedRoute } from './ProtectedRoute'
import { PublicOnlyRoute } from './PublicOnlyRoute'
import { RequireRole } from './RequireRole'

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <PublicOnlyRoute>
        <PublicLandingPage />
      </PublicOnlyRoute>
    ),
  },
  {
    path: '/login',
    element: (
      <PublicOnlyRoute>
        <LoginRegisterPage />
      </PublicOnlyRoute>
    ),
  },
  {
    path: '/oauth/callback',
    element: <OAuthCallbackPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/profile', element: <ProfilePage /> },
      {
        path: '/admin/accounts',
        element: (
          <RequireRole roles={['super_admin']}>
            <AdminAccountsPage />
          </RequireRole>
        ),
      },
      {
        path: '/messages',
        element: <MessagesPage />,
        children: [
          { index: true, element: <MessagesEmptyState /> },
          { path: ':conversationId', element: <ConversationPage /> },
        ],
      },
    ],
  },
])
