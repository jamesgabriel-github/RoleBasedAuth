# Project: Auth-Based SPA (Guest / Dashboard Routing)

## Overview
A single page application (SPA) with role-based authentication and routing. Guests are routed to a public page; logged-in users are redirected to a dashboard on login.

## Tech Stack
- **Backend:** Laravel (API-only, serves as backend for the SPA)
- **Frontend:** ReactJS + TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **Database:** PostgreSQL
- **Architecture:** Single Page Application (SPA) — Laravel serves as an API backend, React handles all routing/rendering client-side (e.g. via React Router)

## Authentication
Support the following login methods:
- Default (username/email + password)
- Google OAuth
- Facebook OAuth
- GitHub OAuth

Use **Laravel Sanctum** for API auth, with Laravel Socialite for Google/Facebook/GitHub OAuth providers.

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

## Routing Behavior
| User State | Behavior |
|---|---|
| Guest (not logged in) | Navigated to the **public page** |
| Logged in | Redirected to the **dashboard page** on login |

- Route guards on the frontend should check auth state before rendering protected routes.
- Role-based access control should determine what each role can see/do within the dashboard (e.g. super admin > admin > client permissions).

## Initial Page Content/Design (placeholder — will be refined later)

### Public Page (Guest landing)
- Simple landing/marketing page: hero section with app name/tagline, brief description, and a "Login" / "Register" call-to-action.
- Optional: basic nav bar (logo, Login/Register buttons), footer.

### Login / Register Page
- Tabbed or toggled Login / Register forms.
- Login: email + password fields, plus "Continue with Google / Facebook / GitHub" buttons.
- Register (client only): first name, middle name, last name, contact number, email, password, confirm password.

### Dashboard Page (Logged-in landing)
- Basic authenticated shell: sidebar or top nav showing user's name and role.
- Placeholder content area (cards/stats) — to be replaced with real widgets later.
- Role-aware nav items (e.g. admin-only links hidden from clients).

### Admin Account Creation Page (secured — super admin only)
- Accessible only to super admin.
- Form to create a new admin/super admin account (name fields, email, password, role selector).
- Simple table listing existing admin/super admin accounts.

## Development Notes for Claude
- Keep Laravel as a pure API (return JSON), do not use Blade views for app pages.
- Use TypeScript types/interfaces for all API responses and shared data models.
- Use shadcn/ui components as the base for UI; extend with Tailwind utility classes rather than custom CSS where possible.
- Database migrations should include a `role` enum or a `roles` table — confirm which pattern before implementing.
- OAuth callback handling should issue the same token/session format as default login so the frontend auth flow is unified regardless of provider.
- Favor small, typed React components and colocate related logic (hooks, types) per feature.

## Open Questions / To Confirm
- None currently — all core requirements above are confirmed. Update this section as new details or edge cases come up during development.
