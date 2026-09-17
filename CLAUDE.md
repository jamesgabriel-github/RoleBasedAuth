# Project: Auth-Based SPA (Guest / Dashboard Routing)

## Overview
A single page application (SPA) with role-based authentication, role-aware routing, and real-time direct messaging. Guests are routed to a public landing page; logged-in users are redirected to a dashboard. All authenticated users can send direct messages to each other with asymmetric discovery (clients search clients; admins/super admins search anyone) and real-time updates via WebSocket.

## Tech Stack
- **Backend:** Laravel 13 (API-only, JSON responses), PostgreSQL, Sanctum (session-based auth), Socialite (OAuth), Reverb (WebSocket broadcasting)
- **Frontend:** React 19 + TypeScript, Vite, Tailwind CSS v4, shadcn/ui, React Router, Echo (WebSocket client)
- **Styling:** Tailwind CSS v4
- **UI Components:** shadcn/ui (+ custom Reverb-aware messaging components)
- **Database:** PostgreSQL with database-backed sessions
- **Architecture:** Single Page Application (SPA) with WebSocket real-time features — Laravel serves as a JSON API backend, React handles all routing/rendering client-side (React Router), Reverb provides real-time bidirectional communication via WebSockets

## Authentication

### Login Methods
Support all of the following (all converge on the same session-cookie flow):
- **Email + Password** (default auth)
- **Google OAuth** (via Laravel Socialite)
- **Facebook OAuth** (via Laravel Socialite)
- **GitHub OAuth** (via Laravel Socialite)

### Session-Based Auth (Not Tokens)
- Use **Laravel Sanctum** in **stateful API mode** (not bearer tokens)
- Session cookies stored in browser; session state persisted in PostgreSQL `sessions` table
- Frontend sends session cookie automatically on every request (via `withCredentials: true`)
- Backend validates session on each request; disabling a user instantly invalidates all their sessions (delete session rows)
- No JWT tokens, no token expiration logic — session lifetime is the single source of truth (`SESSION_LIFETIME=120` minutes)
- OAuth callback flow generates the same session cookie as email/password login — unified auth experience

### Cross-Origin Session Auth
- `SANCTUM_STATEFUL_DOMAINS=localhost:5173` allows frontend origin to use session cookies
- CORS configured to accept credentials and set same-site cookies
- CSRF protection via `X-XSRF-TOKEN` header (token from `XSRF-TOKEN` cookie)

### Registration (Default Auth)
Public registration (from the login/register page) is for **client accounts only**. Required fields:
- First name
- Middle name
- Last name
- Contact number
- Email (Gmail)
- Password

### Admin Account Creation
Admin and super admin accounts are **not** created via public registration. They are created through a separate, secured internal page accessible **only to super admin** users.

## User Roles
Each user has exactly one role, stored as an **enum column** (`role`) directly on the `users` table — no separate `roles` table for the base role:
- `client`
- `admin`
- `super admin`

**Permissions:** Use **spatie/laravel-permission** on top of the enum role for fine-grained permission control. Assign permissions to roles using spatie's role/permission tables. The enum column remains the source of truth for "which role is this user," while spatie handles "what can this role/user actually do."
- Sync spatie roles to match the enum values (`client`, `admin`, `super admin`) so both stay consistent.
- Use spatie's `can()` / `hasRole()` helpers and middleware (`role:`, `permission:`) to guard Laravel API routes.
- Mirror the relevant permission checks on the React side (e.g. via a permissions array returned in the auth/user payload) to conditionally render UI.
- "View logged-in clients" is defined as clients with an **actively open session** (i.e. a valid, non-expired Sanctum token currently in use) — not based on a "last active within X minutes" window. Track via Sanctum's `personal_access_tokens` table (or session store, if using session-based Sanctum) to determine which client accounts currently have a live/valid token.

**Initial permission set:**
- `super admin`: full access to everything, plus:
  - `enable-disable-admin` — enable/disable admin accounts
- `admin`:
  - `enable-disable-client` — enable/disable client accounts
  - `view-logged-in-clients` — view list of all currently logged-in clients
- `client`: no admin-level permissions (standard end-user access only)

## Real-Time Direct Messaging

### Architecture
- **Backend:** Laravel Reverb (WebSocket server) + Illuminate Broadcasting for event distribution
- **Frontend:** Echo.js library to subscribe to channels and listen for events
- **Models:** `Conversation` (between 2 users), `Message` (belongs to conversation), `ConversationParticipant` (tracks read state)
- **Events:** `MessageSent` (broadcast to conversation), `ConversationUpdated` (broadcast to specific participant)
- **Policies:** `ConversationPolicy` enforces participant-only access (even super_admin cannot view others' conversations)

### Discovery (Asymmetric)
- **Clients** can only search other clients when starting a conversation
- **Admins & super_admins** can search any user (client or admin)
- Enforced in `UserSearchController` by role-based query filtering

### Unread Tracking
- Per-participant `last_read_at` timestamp in `conversation_participants` table
- Frontend tracks unread count in `MessagingContext`
- User marks a conversation as read via `PATCH /conversations/{id}/read` (updates their `last_read_at`)
- Real-time update via `ConversationUpdated` broadcast when either participant sends a message

### Queue & Broadcasting
- `QUEUE_CONNECTION=database` — queue jobs stored in database
- `BROADCAST_CONNECTION=reverb` — use Reverb for broadcasting
- Queue worker (`php artisan queue:work`) processes broadcast jobs asynchronously
- Reverb WebSocket server (`php artisan reverb:start`) serves WebSocket connections

## Routing Behavior
| User State | Behavior |
|---|---|
| Guest (not logged in) | Navigated to the **public page** |
| Logged in | Redirected to the **dashboard page** on login |

- Route guards on the frontend should check auth state before rendering protected routes.
- Role-based access control should determine what each role can see/do within the dashboard (e.g. super admin > admin > client permissions).

## Pages & Routes (Status: ✅ Implemented)

### Public Page (Guest landing)
- **Status:** ✅ Implemented (PublicLandingPage)
- Hero section with app tagline and call-to-action buttons
- "Login" and "Register" buttons redirect to login/register page
- Accessible only to unauthenticated users (PublicOnlyRoute guard)

### Login / Register Page
- **Status:** ✅ Implemented (LoginRegisterPage)
- Tabbed interface: "Sign in" and "Sign up" tabs
- Sign in: email + password fields, OAuth buttons (Google, Facebook, GitHub)
- Sign up: first name, middle name, last name, contact number, email, password (client-only registration)
- OAuth error handling (email missing, account exists, etc.)
- Accessible only to unauthenticated users (PublicOnlyRoute guard)

### Dashboard Page
- **Status:** ✅ Implemented (DashboardPage)
- Authenticated shell with sidebar navigation
- Shows current user's name and role
- Role-aware navigation items:
  - All users: "Overview", "Messages"
  - Super admin only: "Admin accounts"
- ProtectedRoute guard ensures only authenticated users access

### Messages Page & Conversation View
- **Status:** ✅ Implemented (MessagesPage, ConversationPage)
- Split view: conversation list (left) + message thread (right)
- Conversation list shows all active conversations with unread badge
- Message thread displays messages, composer, and real-time updates
- User search combobox to start new conversations (role-based discovery)
- Real-time message delivery and read receipts via Reverb WebSocket
- Accessible to all authenticated users

### Admin Accounts Page
- **Status:** ✅ Implemented (AdminAccountsPage)
- Accessible only to super_admin users (RequireRole guard)
- Form to create new admin or super_admin accounts (email, password, role selector)
- Table listing all admin/super_admin accounts with enable/disable actions
- Disabling an account instantly invalidates all their sessions

## Implementation Status

### ✅ Completed
- Session-based Sanctum authentication (no bearer tokens)
- Email/password login + Google/Facebook/GitHub OAuth
- Role-based authorization (enum + spatie/laravel-permission)
- User enable/disable with instant session invalidation
- Real-time messaging with Reverb/Echo WebSocket
- Asymmetric user discovery (clients search clients; admins search all)
- Per-participant unread tracking and read receipts
- Authorization policies (ConversationPolicy prevents super_admin bypass)
- Frontend auth bootstrap (CSRF cookie + identity check on app load)
- React Router with ProtectedRoute, PublicOnlyRoute, RequireRole guards

### 📋 Documentation
- [AUTH_FLOW_GUIDE.md](./AUTH_FLOW_GUIDE.md) — Deep dive into session auth, OAuth, and logout flow
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) — Detailed backend + frontend breakdown
- [MESSAGING_IMPLEMENTATION.md](./MESSAGING_IMPLEMENTATION.md) — WebSocket, Reverb, channel authorization, real-time updates

## Development Notes for Claude

### Architecture & Code Style
- **Backend:** Pure API (return JSON), no Blade views for app pages
- **Frontend:** TypeScript for all types, React components colocated with hooks/types per feature
- **UI:** shadcn/ui as base; extend with Tailwind v4 utilities (no custom CSS)
- **Components:** Favor small, composable components with clear prop contracts

### Authentication Flow (Reference)
1. User logs in (email or OAuth) → session created → session cookie stored in browser
2. Frontend bootstrap: fetch CSRF token, then GET `/api/user` to load user state
3. On every request: session cookie sent automatically (Sanctum validates on backend)
4. On logout: session row deleted → request returns 401 → frontend clears user state
5. ProtectedRoute re-evaluates when AuthContext `user` changes → redirect to "/" if null

### Authorization Pattern
- Roles: enum on `users.role` column (source of truth)
- Permissions: spatie/laravel-permission tables (fine-grained control)
- Routes: guarded by `middleware('role:...')` or `middleware('permission:...')`
- Models: protected by Laravel `Gate::authorize()` calling policy methods
- Frontend: `requiredPermissions` array in user response; UI conditionally renders based on `useAuth().user.permissions`

### Messaging & WebSocket
- Events (`MessageSent`, `ConversationUpdated`) broadcast via Reverb
- Channels require authorization via `ConversationPolicy` (participant-only)
- Frontend `MessagingContext` manages Echo connection lifecycle (connect on login, disconnect on logout)
- `useConversationChannel` hook subscribes to conversation updates in real-time

### Session & Cookies
- `SESSION_DRIVER=database` — sessions persisted in PostgreSQL
- `SESSION_LIFETIME=120` — minutes; no refresh/extend logic
- `SANCTUM_STATEFUL_DOMAINS=localhost:5173` — allows frontend origin to use session cookies
- Disabling a user deletes their session rows instantly (no token expiry to wait for)

## Known Constraints & Design Decisions
- **No token refresh:** Session expires after `SESSION_LIFETIME` minutes; user must log in again (no "remember me" or refresh tokens)
- **Session-only auth:** No bearer tokens; simplifies CORS and avoids token storage on frontend
- **Conversation privacy:** ConversationPolicy blocks all access to private conversations (even super_admin cannot bypass)
- **Asymmetric discovery:** Frontend enforces role-based user search via `UserSearchController` filtering
- **Real-time is broadcast-only:** Messages sync one-way (broadcaster → listeners); no fallback if WebSocket disconnects mid-message
- **Unread count is participant-specific:** No "global unread" badge; each user tracks their own read state

## Open Questions / To Confirm
- None currently — all core requirements above are confirmed and implemented. Update this section as new edge cases or feature requests come up.
