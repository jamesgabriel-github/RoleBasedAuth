# Role-Based Auth SPA

A single-page application with role-based authentication and routing — guests see a public landing page, authenticated users are routed to a role-aware dashboard. Built as a Laravel API backend paired with a separate React SPA frontend, using cookie-based session authentication (Laravel Sanctum) rather than bearer tokens.

## Features

- **Authentication**: email/password + Google, Facebook, and GitHub OAuth (Laravel Socialite), all converging on the same Sanctum session-cookie flow
- **Roles**: `client`, `admin`, `super_admin` — an enum column on `users`, layered with [spatie/laravel-permission](https://spatie.be/docs/laravel-permission) for fine-grained permission checks
- **Client self-registration**: public sign-up creates `client` accounts only
- **Admin management**: super admins create `admin`/`super_admin` accounts through a secured internal page — no public registration for elevated roles
- **Live session tracking**: "currently logged-in clients" reflects actual open sessions (queried from the `sessions` table), not an activity-recency guess
- **Instant enable/disable**: disabling a user deletes their session rows immediately — no waiting for a token to expire
- **Guardrails**: a user can't disable their own account; the last active super admin can't be disabled
- **Real-time direct messaging**: plain-text, asynchronous messaging between users with asymmetric discovery (clients can only search other clients; admins/super_admins can search anyone) and per-participant unread tracking

## Tech Stack

| | |
|---|---|
| **Backend** | Laravel 13 (PHP 8.4), PostgreSQL, Sanctum, Socialite, spatie/laravel-permission |
| **Frontend** | React 19 + TypeScript, Vite, Tailwind CSS v4, shadcn/ui, React Router |

## Project Structure

```
.
├── backend/     Laravel API (JSON only, no Blade views for app pages)
└── frontend/    React SPA (Vite)
```

See [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) for a detailed breakdown of what's implemented on each side, [AUTH_FLOW_GUIDE.md](./AUTH_FLOW_GUIDE.md) for a deep dive into how the cookie-based auth, session persistence, and OAuth redirect flow work end to end, and [MESSAGING_IMPLEMENTATION.md](./MESSAGING_IMPLEMENTATION.md) for the real-time direct messaging architecture (Reverb broadcasting, channel authorization, async unread tracking).

## Prerequisites

- PHP 8.4+ and Composer
- Node.js 20+ and npm
- PostgreSQL (running locally or reachable remotely)

## Setup

### 1. Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Edit `.env` with your PostgreSQL credentials and (optionally) OAuth app credentials:

```env
DB_DATABASE=first_db
DB_USERNAME=postgres
DB_PASSWORD=your-password

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
FACEBOOK_CLIENT_ID=...
FACEBOOK_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

BROADCAST_CONNECTION=reverb
QUEUE_CONNECTION=database
REVERB_APP_ID=<generated-id>
REVERB_APP_KEY=<generated-key>
REVERB_APP_SECRET=<generated-secret>
```

> OAuth apps must have their redirect URI set to `http://localhost:8000/auth/{provider}/callback` in each provider's developer console. Skip this if you only need email/password login.
>
> Reverb credentials are auto-generated during `install:broadcasting` and are safe for local dev (no external secrets).
> Frontend also needs `VITE_REVERB_APP_KEY`, `VITE_REVERB_HOST`, `VITE_REVERB_PORT`, `VITE_REVERB_SCHEME` in `frontend/.env` — copy the corresponding values from the backend `.env`.

Create the database, then run migrations and seed roles/permissions + a bootstrap super admin:

```bash
php artisan migrate --seed
```

The seeded super admin credentials come from `.env`:
```env
SUPER_ADMIN_EMAIL=superadmin@example.com
SUPER_ADMIN_PASSWORD=change-me-in-local-env
```

Start the server:

```bash
php artisan serve
# → http://localhost:8000
```

For real-time messaging support, also start the WebSocket server and queue worker (in separate terminals):

```bash
php artisan reverb:start
# → Reverb server running on localhost:8080

php artisan queue:work
# → Queue worker listening for broadcast jobs
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
# → http://localhost:5173
```

### 3. Log in

Visit `http://localhost:5173` and either register a new client account or log in as the seeded super admin. Once logged in, all users (clients and admins) can access the messaging feature to send direct messages.

## Debugging

- Backend logs: `backend/storage/logs/laravel.log`
- Set `APP_DEBUG=true` in `backend/.env` for detailed error pages
- [Laravel Telescope](https://laravel.com/docs/telescope) can be added for request/query/exception inspection in local dev
- Browser DevTools Network tab is the fastest way to inspect failed API calls (CORS/CSRF issues show up there first)

## Common Commands

| Command | Where | What |
|---|---|---|
| `php artisan serve` | `backend/` | Run the API server |
| `php artisan reverb:start` | `backend/` | Run the WebSocket server (needed for real-time messaging) |
| `php artisan queue:work` | `backend/` | Run the queue worker (processes broadcast jobs for messaging) |
| `php artisan migrate:fresh --seed` | `backend/` | Reset the database to a clean seeded state |
| `php artisan tinker` | `backend/` | Interactive REPL for testing backend code |
| `npm run dev` | `frontend/` | Run the Vite dev server |
| `npm run build` | `frontend/` | Type-check and build for production |
