# Implementation Summary

Auth-based SPA (guest/dashboard routing) implemented per [CLAUDE.md](./CLAUDE.md): Laravel API backend + React SPA frontend, monorepo layout (`backend/`, `frontend/`), Sanctum SPA cookie authentication, Socialite OAuth, spatie/laravel-permission roles.

## Backend (`backend/`) — Laravel 13

### Stack & setup
- Laravel 13, PHP 8.4.15, PostgreSQL (`first_db`), native WAMP (no Docker/Sail)
- Packages: `laravel/sanctum` (via `php artisan install:api`), `laravel/socialite` (`^5.31`), `spatie/laravel-permission` (`^8.3`)
- Sanctum configured for **SPA cookie auth**, not bearer tokens — `statefulApi()` middleware, `SANCTUM_STATEFUL_DOMAINS=localhost:5173`, `SESSION_DRIVER=database`, CORS (`config/cors.php`) locked to the frontend origin with `supports_credentials: true`

### Database
- `users` — `first_name`, `middle_name` (nullable), `last_name`, `contact_number` (nullable), `email` (unique), `password` (nullable, for OAuth-only accounts), `role` enum (`client` / `admin` / `super_admin`), `is_active` boolean
- `social_accounts` — links a user to a provider identity (`provider`, `provider_user_id`, `avatar_url`), unique on `(provider, provider_user_id)`
- `sessions` (Laravel's stock table, already included in the base migration) — backbone of the "logged-in clients" feature
- spatie's permission tables (`roles`, `permissions`, `model_has_roles`, `model_has_permissions`, `role_has_permissions`), guard `web`

### Roles & permissions
- `App\Enums\UserRole` enum backs the `role` column; `super_admin` is the actual stored value (spec's literal "super admin" with a space isn't usable in enum/middleware syntax — display label is "Super Admin")
- `RolePermissionSeeder` creates the 3 spatie roles and 3 permissions (`enable-disable-admin`, `enable-disable-client`, `view-logged-in-clients`), assigns `admin` its two client-management permissions, and **explicitly syncs every permission to `super_admin`** (not just `enable-disable-admin`) so the `permissions` array returned to the frontend reflects full access
- `AppServiceProvider::boot()` adds a `Gate::before` that grants `super_admin` every ability server-side regardless of the synced list — the seeder sync above exists purely so the frontend's UI-gating stays accurate, not as the actual authorization boundary
- `SuperAdminSeeder` bootstraps one super admin from `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` in `.env`

### Auth endpoints (`routes/api.php`, `routes/web.php`)
- `POST /api/register` — client-only public registration
- `POST /api/login`, `POST /api/logout`, `GET /api/user` (returns user + flattened `permissions` array)
- `GET /auth/{provider}/redirect`, `GET /auth/{provider}/callback` (`web` middleware group, needed for Socialite's session-based `state` handling) for `google`, `facebook`, `github`

### OAuth flow (`SocialiteController`)
Full browser redirect (not fetch) → Laravel starts a session, Socialite stores `state` → provider consent → callback validates `state`, looks up by `(provider, provider_user_id)` first, then **blocks silent linking** if the email matches an existing account (redirects back with `?error=email_exists` rather than auto-merging accounts) → on success, logs in, regenerates the session, and redirects to the SPA's `/oauth/callback` — the `Set-Cookie` on that redirect is what plants the authenticated session before the SPA even loads.

### Admin features
- `AdminAccountController` — super-admin-only create/list of admin & super-admin accounts
- `UserStatusController` — enable/disable for clients and admins/super-admins; disabling **deletes the user's `sessions` rows + Sanctum tokens in a transaction**, so an already-open session is killed immediately rather than waiting for expiry
- Guardrails: a user cannot disable their own account; the last active `super_admin` cannot be disabled
- `LoggedInClientsController` — "currently logged-in clients" is answered by querying the `sessions` table for rows with `last_activity` within `session.lifetime`, joined to `client` users — this mirrors exactly what Laravel itself considers a live session (not an arbitrary "active in last N minutes" heuristic, since cookie-based auth never populates `personal_access_tokens`)
- `EnsureAccountIsActive` middleware — defense-in-depth: if a disabled user's session is still mid-flight, the request is rejected and the session is invalidated server-side

### Route protection
`auth:sanctum` + `account.active` on all authenticated routes; `permission:*` / `role:super_admin` middleware (spatie) gate the admin-only endpoints.

## Frontend (`frontend/`) — Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui

### Stack & setup
- Vite + `react-ts` template, Tailwind v4 (CSS-first, `@import "tailwindcss"` in `index.css`, no config file), shadcn/ui (Nova preset, Radix primitives), React Router v6, Axios
- `@/*` path alias wired in both `vite.config.ts` and `tsconfig.app.json`
- `lib/api-client.ts` — Axios instance with `withCredentials: true` **and `withXSRFToken: true`** (required as of Axios 1.6+ for cross-origin cookie auth — backend on :8000, frontend on :5173 are different origins) plus `ensureCsrfCookie()` to bootstrap Sanctum's CSRF cookie

### Structure
```
src/
  lib/            api-client.ts, errors.ts (API error → message helper), utils.ts (shadcn's cn())
  types/          user.ts (User, Role), api.ts (ApiErrorResponse)
  features/
    auth/         AuthContext.tsx, api.ts, types.ts, components/ (LoginForm, RegisterForm, OAuthButtons)
    dashboard/    components/ (DashboardShell, Sidebar, TopNav), roleLabels.ts
    admin/        api.ts, components/ (CreateAdminForm, AdminAccountsTable, LoggedInClientsTable)
  routes/         router.tsx, ProtectedRoute, PublicOnlyRoute, RequireRole, RequirePermission
  pages/          PublicLandingPage, LoginRegisterPage, OAuthCallbackPage, DashboardPage, AdminAccountsPage
  components/ui/  shadcn-generated primitives (button, input, card, tabs, table, dialog, dropdown-menu, etc.)
```

### Auth & routing
- `AuthContext` bootstraps on app load (`ensureCsrfCookie()` → `GET /api/user`), exposes `login`/`register`/`logout`/`refetch`
- Route guards: `PublicOnlyRoute` (redirects authenticated users to `/dashboard`), `ProtectedRoute` (redirects unauthenticated users to `/`, the public landing page — matches the spec's "guest → public page" rule), `RequireRole`, `RequirePermission` (used inline to hide/show dashboard widgets like the logged-in-clients table)
- OAuth buttons do a full `window.location.href` redirect (not fetch) to `{API_URL}/auth/{provider}/redirect`; `/oauth/callback` reads `?error=` or re-bootstraps auth state and lands on `/dashboard`

### Pages
- **Public landing** — hero, nav, footer, CTAs to login/register
- **Login/Register** — shadcn Tabs, manual controlled-input forms (no react-hook-form — the shadcn CLI's current registry doesn't ship a `form` component for this base/template combo), OAuth buttons on the login tab
- **Dashboard** — role-aware sidebar (super-admin-only "Admin accounts" link), stat cards (role, status, permission count), logged-in-clients table gated behind the `view-logged-in-clients` permission
- **Admin accounts** (super-admin only, `RequireRole`) — create-admin form + accounts table with enable/disable actions

## Bugs found and fixed during end-to-end testing
Verified via curl (backend) and a Playwright-driven headless browser (frontend), since no project "run" skill existed yet for this brand-new app:
1. **`is_active`/`email_verified_at` missing from `User`'s fillable list** — enable/disable and OAuth account creation would have silently no-opped on those fields.
2. **Axios 1.6+ cross-origin CSRF header** — needed `withXSRFToken: true`, otherwise every state-changing request 419'd in a real browser (frontend and backend are different origins/ports).
3. **Logout race condition** — `TopNav`'s explicit `navigate('/')` raced `ProtectedRoute`'s own redirect-on-unauthenticated (which fired to `/login`); fixed by having the guard redirect to `/` instead, matching the spec's guest-routing rule, and removing the now-redundant manual navigation.
4. **Super admin's dashboard permission-gated widgets weren't showing** — `Gate::before` grants access server-side but doesn't populate the `permissions` array the frontend uses for UI rendering; fixed by explicitly syncing all permissions to `super_admin` in the seeder.

## Manual steps still required
- **OAuth apps**: Google/Facebook/GitHub OAuth app credentials now configured in `backend/.env` (redirect URIs `http://localhost:8000/auth/{provider}/callback`) — not yet exercised end-to-end since it requires interactive provider consent.
- **Change `SUPER_ADMIN_PASSWORD`** in `backend/.env` from the seeded placeholder before any shared/deployed use.
- **Run it**: `cd backend && php artisan serve` and `cd frontend && npm run dev`, then visit `http://localhost:5173`.
