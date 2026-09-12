# Authentication & Session Flow Guide

This document explains how authentication, session persistence, and redirection work in this Laravel + React SPA project.

## Core Concept: Cookie-Based Session Auth

Your frontend (`localhost:5173`) and backend (`localhost:8000`) are **different origins**, but instead of the SPA storing a bearer token in JavaScript, Laravel Sanctum treats the frontend as a trusted "stateful" client and uses an **httpOnly session cookie** — the same mechanism a traditional server-rendered app uses.

**Why cookies instead of tokens?**
- Safer: tokens in JS can leak via XSS; cookies are httpOnly (JS can't read them)
- Instant revocation: disabling a user deletes their session row, forcing them out on the next request
- Simpler: no manual token refresh logic needed

---

## 1. App Load → CSRF Bootstrap → Identity Check

Every time the SPA mounts, [`AuthContext.tsx`](frontend/src/features/auth/AuthContext.tsx) runs a `bootstrap()` effect in `useEffect`:

```typescript
// From AuthContext.tsx
useEffect(() => {
  (async () => {
    await ensureCsrfCookie()          // Step 1: Get the XSRF token
    try {
      const { data } = await apiClient.get('/api/user')  // Step 2: Check if logged in
      setUser(data.user)
    } catch {
      setUser(null)                   // 401 on first load = expected, just a guest
    } finally {
      setLoading(false)
    }
  })()
}, [])
```

### Step 1: `ensureCsrfCookie()` — GET `/sanctum/csrf-cookie`

```
Frontend                           Backend
  |-- GET /sanctum/csrf-cookie --->|
  |                                | (Sanctum route, no auth needed)
  |<-- Set-Cookie: XSRF-TOKEN -----|
  |<-- Set-Cookie: laravel-session |
```

This Sanctum built-in route:
- Starts a Laravel **session** (creates a row in the `sessions` table)
- Returns two cookies:
  - `laravel-session` (httpOnly) — the actual session ID (auto-attached by browser on all requests)
  - `XSRF-TOKEN` (readable by JS) — an anti-forgery token

### Step 2: `GET /api/user` — Check identity

Axios is configured with:
```typescript
// From lib/api-client.ts
withCredentials: true        // Send cookies with requests
withXSRFToken: true          // Read XSRF-TOKEN cookie and echo it back as X-XSRF-TOKEN header
xsrfCookieName: 'XSRF-TOKEN'
xsrfHeaderName: 'X-XSRF-TOKEN'
```

So the request carries:
- Cookie: `laravel-session=<id>` (auto-attached)
- Header: `X-XSRF-TOKEN: <token>` (axios inserts this)

The backend's `StartSession` middleware:
1. Reads the `laravel-session` cookie → looks up that row in the `sessions` table
2. If found and valid, deserializes the `payload` → recovers the logged-in user's ID
3. `Auth::user()` returns that user for this request
4. If no row exists → guest session (no user)

**Why a 401 on first load is fine:** On app startup, there's no session row yet, so `Auth::user()` is null, and `UserController::me()` returns 401. That's expected. `AuthContext` catches it and sets `user = null` — that's "you're a guest, not an error."

---

## 2. Logging In

User fills the login form and submits. [`LoginForm.tsx`](frontend/src/features/auth/components/LoginForm.tsx) calls:

```typescript
const { data } = await apiClient.post('/api/login', { email, password })
setUser(data.user)
navigate('/dashboard')
```

### Backend: `POST /api/login`

[`LoginController::store`](backend/app/Http/Controllers/Api/Auth/LoginController.php):

```php
$credentials = $request->only('email', 'password');

if (!Auth::attempt($credentials)) {
    throw ValidationException::withMessages(['email' => 'Invalid credentials']);
}

$user = Auth::user();  // User is now set on the session
$request->session()->regenerate();  // Rotate the session ID (prevents fixation attacks)

return response()->json(['user' => new UserResource($user)]);
```

**What happens:**
1. `Auth::attempt()` checks the password against the `users` table
2. If valid, Laravel writes the user's ID into the **session row** already created by `/sanctum/csrf-cookie`
3. `$request->session()->regenerate()` creates a NEW session row and sends a `Set-Cookie` with a fresh session ID
4. Return the authenticated user

**Important:** No token is created. The browser now just automatically sends the `laravel-session` cookie on every request to `localhost:8000`.

### Frontend After Login

```typescript
// AuthContext updates
setUser(loggedInUser)  // App re-renders, now sees a user

// Navigate to dashboard
navigate('/dashboard')

// ProtectedRoute guard now passes (user exists) and mounts <DashboardPage />
```

---

## 3. Session Persistence: The `sessions` Table

This is critical to understanding how the user "stays logged in." With `SESSION_DRIVER=database` in `.env`, every session is a row in the `sessions` table:

| Column | Example |
|--------|---------|
| `id` | `abc123def456` (hashed cookie value) |
| `user_id` | `1` |
| `ip_address` | `127.0.0.1` |
| `user_agent` | `Mozilla/5.0...` |
| `payload` | (serialized PHP session data) |
| `last_activity` | `1726056789` (Unix timestamp) |

### On every API request:

1. Browser sends: `Cookie: laravel-session=abc123def456`
2. Laravel's `StartSession` middleware:
   - Looks up `sessions.id = 'abc123def456'`
   - Deserializes `payload` → recovers `user_id = 1`
   - Calls `Auth::login(User::find(1))`
   - Updates `last_activity = now()`
3. Your controller code sees `Auth::user()` → the User with ID 1
4. Your response includes that user's data

### This is why disable = instant logout:

When you disable a user, [`UserStatusController::applyStatus`](backend/app/Http/Controllers/Api/Admin/UserStatusController.php) does:

```php
DB::transaction(function () use ($targetUser) {
    $targetUser->update(['is_active' => false]);
    DB::table('sessions')->where('user_id', $targetUser->id)->delete();  // Delete all rows
    $targetUser->tokens()->delete();  // Also delete Sanctum tokens (for safety)
});
```

**Result:** The disabled user's browser still has the cookie, but its session row no longer exists. On the next API request:
- Laravel looks for `sessions.id = <cookie value>` → not found
- No user is attached to the request
- `auth:sanctum` middleware returns 401
- Frontend's `useAuth` catches that and redirects to `/` (public page)

---

## 4. Sanctum's Role: Making `/api/*` Accept Sessions

Normally, session-based auth only works on `web` routes, not `api` routes. Sanctum's `statefulApi()` middleware (in [`bootstrap/app.php`](backend/bootstrap/app.php)) makes an exception:

```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->statefulApi();  // This line is the magic
    ...
})
```

It wraps your `/api/*` routes so that **if**:
- The request comes from `SANCTUM_STATEFUL_DOMAINS` (your `.env` has `localhost:5173`), **and**
- The request carries a valid session cookie,

**then** `auth:sanctum` treats it as an authenticated session request, reading the user from the session table (not from a token).

**This is the entire trick** that lets a separately-hosted SPA use cookie auth against an API.

---

## 5. Frontend Route Guards: How Auth State Controls Navigation

[`router.tsx`](frontend/src/routes/router.tsx) wraps routes in guard components that read `AuthContext`:

### `PublicOnlyRoute` (/, /login)
```typescript
if (user) return <Navigate to="/dashboard" replace />
return <>{children}</>
```
- If you're already logged in and hit `/login`, bounce to `/dashboard`
- This is why a logged-in user can't re-see the login form

### `ProtectedRoute` (/dashboard, /admin/accounts, etc.)
```typescript
if (!user) return <Navigate to="/" replace />
return <Outlet />
```
- If you're not logged in, bounce to `/` (the public landing page, per spec)
- This is why logout takes you to the hero landing page, not `/login`

### `RequireRole` (used on `/admin/accounts`)
```typescript
if (!roles.includes(user.role)) return <Navigate to="/dashboard" replace />
return <>{children}</>
```
- Only `super_admin` can see `/admin/accounts`; others bounce to `/dashboard`

### `RequirePermission` (used inline in DashboardPage)
```typescript
if (!user.permissions.includes(permission)) return null  // Just don't render this widget
```
- Doesn't redirect; just hides the widget if you lack the permission
- Used for the "logged-in clients" table (admin/super-admin only)

**None of these guards call the API themselves** — they all just read the `user` object that `AuthContext` fetched once at bootstrap. This is why logout had that race condition you saw earlier: the moment `setUser(null)` runs, `ProtectedRoute` (still mounted) immediately re-evaluates and redirects.

---

## 6. Logging Out

User clicks the dropdown → "Log out" → [`TopNav.tsx`](frontend/src/features/dashboard/components/TopNav.tsx):

```typescript
<DropdownMenuItem onClick={() => logout()}>Log out</DropdownMenuItem>
```

### Frontend: `logout()` from AuthContext

```typescript
export async function logout(): Promise<void> {
  await ensureCsrfCookie()  // Refresh CSRF token
  await apiClient.post('/api/logout')  // Send the logout request
  setUser(null)  // Tell React "you're no longer logged in"
}
```

### Backend: `POST /api/logout`

[`LoginController::destroy`](backend/app/Http/Controllers/Api/Auth/LoginController.php):

```php
public function destroy(Request $request): JsonResponse
{
    Auth::guard('web')->logout();           // Clears the user from the session
    $request->session()->invalidate();      // Invalidates the entire session
    $request->session()->regenerateToken(); // Regenerates the CSRF token

    return response()->json(['message' => 'Logged out.']);
}
```

**What this does:**
1. `logout()` removes the user ID from the session payload (but the session row still exists)
2. `invalidate()` deletes the session row entirely
3. `regenerateToken()` generates a new CSRF token (in case the old one was compromised)

**Result:** The user's browser still has the old `laravel-session` cookie, but that session row no longer exists. Frontend:
1. Calls `logout()` API (succeeds)
2. Sets `user = null` in React
3. `ProtectedRoute` sees `!user` and redirects to `/`
4. On next request, the browser's old cookie won't map to any session row → truly logged out

---

## 7. OAuth Flow: Full Redirect Dance

Unlike login (which is an API call), OAuth requires a full **browser redirect** because the provider's consent screen must be top-level.

### Step-by-step:

```
1. Click "Continue with Google" button
   → window.location.href = 'http://localhost:8000/auth/google/redirect'
   
2. Backend: GET /auth/google/redirect (web middleware)
   → Laravel session already started (from earlier /sanctum/csrf-cookie)
   → Socialite stores a `state` nonce in that session
   → 302 redirect to Google's OAuth endpoint
   
3. User consents on Google
   → Google redirects to http://localhost:8000/auth/google/callback?code=...&state=...
   
4. Backend: GET /auth/google/callback
   → Validate `state` against the session
   → Exchange `code` for a Google access token
   → Call Google API to get user profile (email, name, avatar)
   
   a. If social_account row exists for (google, provider_user_id):
      → Log in that user (Auth::login())
      
   b. If email is missing:
      → Redirect back to SPA with ?error=email_missing
      
   c. If email exists but no social_account link:
      → Redirect back with ?error=email_exists (block silent linking)
      
   d. If this is a brand-new user:
      → Create User (role=client, is_active=true)
      → Create social_account row linking them
      → Log in (Auth::login())
   
   → Session row now has user_id set
   → Regenerate session to prevent fixation
   → 302 redirect to SPA: http://localhost:5173/oauth/callback
      (This response carries Set-Cookie: laravel-session=<new id>)
   
5. Browser navigates to /oauth/callback (SPA)
   → Browser now has the fresh laravel-session cookie planted
   
6. Frontend: OAuthCallbackPage mounts
   → Call refetch() → GET /api/user
   → Now succeeds because session cookie is valid
   → set the user
   → navigate('/dashboard')
```

**Key insight:** The session cookie is planted by the redirect response itself (step 4's Set-Cookie header), before the SPA even loads. By the time the SPA runs, the browser already has a valid session.

---

## Why Email Linking is Blocked

When a new OAuth user signs in, we have their `provider_user_id` (Google's unique ID for them) but we also have their email. The code checks:

```php
$existingLink = SocialAccount::where('provider', 'google')
    ->where('provider_user_id', $socialUser->getId())
    ->first();

if ($existingLink) {
    return $this->logInAndRedirect($request, $existingLink->user, $frontendUrl);
}

// If no link exists, check if the email already belongs to someone
$existingUser = User::where('email', $socialUser->getEmail())->first();

if ($existingUser) {
    // Block silent account linking — redirect back with an error
    return redirect()->away("{$frontendUrl}/oauth/callback?error=email_exists&provider=google");
}

// Only if it's truly a brand new user do we create them
$user = $this->createUserFromSocialite('google', $socialUser);
```

**Why?** If Alice has an account with password auth at `alice@example.com`, and then Bob registers a fake Google account with Alice's email (if the provider allows it), Bob would be silently logged in as Alice. This is an **account takeover vector**, so we block it.

---

## Summary: The Complete Request/Response Cycle

```
┌─ Guest visits http://localhost:5173
├─ AuthContext::bootstrap() runs
│  ├─ GET /sanctum/csrf-cookie → Set-Cookie: XSRF-TOKEN, laravel-session
│  └─ GET /api/user → 401 (no session row yet)
│     → setUser(null) → render as guest
│
├─ Guest submits login form
│  └─ POST /api/login { email, password }
│     → Auth::attempt() ✓
│     → Write user_id to session row
│     → Return { user: {...} }
│     → setUser(user) → re-render as logged-in
│
├─ Logged-in user navigates to /dashboard
│  └─ ProtectedRoute checks: user exists ✓ → mount <DashboardPage />
│
├─ Logged-in user makes API request
│  └─ GET /api/admin/clients/logged-in
│     → Browser auto-attaches: Cookie: laravel-session=abc123
│     → StartSession reads sessions table → recovers user_id
│     → auth:sanctum middleware → user is set for this request
│     → Controller returns data
│
├─ Admin disables user
│  └─ PATCH /admin/clients/2/status { is_active: false }
│     → Delete all rows from sessions where user_id=2
│     → User's browser still has the old cookie, but NO matching row
│
├─ Disabled user's browser makes next request (even before knowing they're disabled)
│  └─ GET /api/user
│     → StartSession finds no matching session row
│     → Anonymous session (no user)
│     → 401 Unauthorized
│     → Frontend catches it → setUser(null) → redirect to /
│
└─ User clicks logout
   ├─ POST /api/logout
   │  → invalidate() deletes the session row
   │  → 200 OK
   ├─ Frontend: setUser(null) → re-render
   └─ ProtectedRoute re-evaluates → user missing → Navigate to /
```

---

## Key Files

- **Frontend**
  - [`AuthContext.tsx`](frontend/src/features/auth/AuthContext.tsx) — bootstrap, login/logout, user state
  - [`lib/api-client.ts`](frontend/src/lib/api-client.ts) — Axios with cookies & CSRF
  - [`routes/`](frontend/src/routes/) — ProtectedRoute, PublicOnlyRoute, RequireRole, RequirePermission

- **Backend**
  - [`bootstrap/app.php`](backend/bootstrap/app.php) — `statefulApi()` middleware
  - [`config/cors.php`](backend/config/cors.php) — `supports_credentials: true`
  - [`app/Http/Controllers/Api/Auth/`](backend/app/Http/Controllers/Api/Auth/) — LoginController, RegisterController, UserController, SocialiteController
  - [`app/Http/Middleware/EnsureAccountIsActive.php`](backend/app/Http/Middleware/EnsureAccountIsActive.php) — defense-in-depth check on protected routes

- **Environment**
  - `backend/.env` — `SANCTUM_STATEFUL_DOMAINS=localhost:5173`, `SESSION_DRIVER=database`, `SESSION_LIFETIME=120`
