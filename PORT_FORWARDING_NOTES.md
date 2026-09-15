# Notes: Exposing the App via Port Forwarding (VS Code Dev Tunnels)

Summary of what we ran into trying to make this local Laravel + React SPA setup
(frontend on :5173, backend on :8000, Reverb websocket on :8080) reachable through
VS Code's port forwarding (Microsoft Dev Tunnels), and why the attempt was ultimately
reverted in favor of plain LAN access.

## Problems encountered, in order

1. **Vite blocked the tunnel's Host header.** Vite's dev server rejects requests whose
   `Host` header isn't localhost-like, as a DNS-rebinding protection. The tunnel URL
   showed a "Blocked request" page instead of the app until `server.allowedHosts` was
   added to `vite.config.ts`.

2. **CORS / wrong-origin failures.** The frontend's `VITE_API_URL` and the backend's
   `FRONTEND_URL` / `SANCTUM_STATEFUL_DOMAINS` were still pointing at `localhost`, so
   the browser (now loaded from a tunnel URL) was calling back into its *own*
   `localhost:8000` instead of the tunnel-forwarded backend, and the backend's CORS
   config didn't recognize the tunnel frontend origin. Fixed by updating both `.env`
   files to the actual `*.devtunnels.ms` URLs generated for each forwarded port.

3. **~3 minute page load.** Vite's dev server doesn't bundle the app — it serves every
   component/module as its own individual HTTP request (native ES modules), which is
   fine at ~0ms latency on `localhost` but became minutes-long once every one of those
   hundreds of requests had to round-trip through the tunnel relay. Fixed by building
   the frontend for production (`npm run build`) instead of serving the raw dev server.

4. **"CSRF token mismatch" on register/login — the blocking issue.** This is the one
   that couldn't be solved with configuration. See below.

5. **(After switching to LAN access instead) Video/voice calls failed with "Unable to
   join the call."** `navigator.mediaDevices.getUserMedia` (used for the WebRTC camera/
   mic stream) is only available in a *secure context* — HTTPS, or the special-cased
   `localhost`/`127.0.0.1`. A plain `http://<LAN-IP>:5173` origin doesn't qualify, so
   the browser hides the whole `mediaDevices` API and the call fails immediately.
   Workarounds: a per-browser Chrome/Edge flag
   (`unsafely-treat-insecure-origin-as-secure`) for quick testing, or real local HTTPS
   via `mkcert` for something more permanent.

## Why separate ports for frontend and backend don't work over a public tunnel

The app uses **Laravel Sanctum's cookie-based SPA authentication**: login sets a
session cookie, and CSRF protection works by the backend handing the frontend an
`XSRF-TOKEN` cookie which the frontend's JavaScript is expected to read (via
`document.cookie`) and echo back as a request header.

That read step is the failure point. **A cookie is only readable by JavaScript running
on the exact domain the cookie was scoped to** (its `Domain` attribute). VS Code Dev
Tunnels give every forwarded port its own distinct hostname —
`5th5l9bk-5173.asse.devtunnels.ms` for the frontend, `5th5l9bk-8000.asse.devtunnels.ms`
for the backend. These are different sites, not just different ports of the same site.
So the `XSRF-TOKEN` cookie set for the backend's hostname can never be read by JS
running on the frontend's hostname — no Laravel/Sanctum setting changes that, because
it's an intentional browser rule (Same-Origin Policy for cookie storage), not a server
config.

Settings that look like they should fix this, but don't:
- **`SANCTUM_STATEFUL_DOMAINS`** — only tells Sanctum which origins are trusted to use
  cookie/session auth at all (vs. requiring a Bearer token). It's necessary for the
  CSRF check to even run, but doesn't make the cookie itself readable across origins.
  We had this set correctly and still hit the mismatch.
- **`SESSION_DOMAIN`** — can only be set to the current host or a *parent* domain of
  it, never an unrelated host. There is no value that covers two independent
  `devtunnels.ms` subdomains.
- **CORS (`allowed_origins`, `supports_credentials`)** — controls whether the browser
  lets a cross-origin XHR/fetch happen and whether cookies are *sent* with it; it has
  no bearing on whether page JavaScript can *read* a cookie's value.

There's also a structural reason a shared `SESSION_DOMAIN` couldn't help even if
attempted: `devtunnels.ms` (like `ngrok-free.app` or `trycloudflare.com`) is a
**public suffix** — browsers refuse to let a cookie be scoped to a public suffix
domain (e.g. `SESSION_DOMAIN=.devtunnels.ms`), precisely to stop one random tenant's
subdomain from reading another's cookies.

**This only breaks down when frontend and backend are on genuinely different
hostnames.** Same host, different ports (e.g. testing over LAN at
`192.168.100.12:5173` and `192.168.100.12:8000`) does *not* hit this problem — cookie
scoping and `SameSite` matching both ignore port number, so the two ports are treated
as the same site. That's why the LAN approach worked without any of the
`SESSION_SAME_SITE=none` / `SESSION_SECURE_COOKIE=true` cross-site cookie gymnastics
the tunnel setup needed.

## What actually fixed the tunnel case (then reverted)

Collapsed frontend and backend onto **one origin**: built the frontend
(`npm run build`), copied the output into `backend/public`, and added a Laravel
catch-all route to serve the SPA's `index.html` for any non-API path. With only one
tunnel URL for the whole app, there was no cross-site boundary left for cookies to
cross — CSRF worked normally, and the earlier slow-load problem was solved as a side
effect (production build, no unbundled dev-server requests).

This was reverted once the goal shifted to same-network device testing instead of a
public link, since LAN access doesn't have the cross-site cookie problem in the first
place and is simpler to reason about.

## Options for a real deployment (not just a one-off demo)

- Keep serving frontend + backend from one origin (what we did above) — the simplest,
  most robust option, and how you'd likely deploy to production anyway.
- Use a **custom domain you control** with ngrok's reserved-domain tier or a Cloudflare
  Tunnel mapped to your own DNS zone, with `app.yourdomain.com` / `api.yourdomain.com`
  and `SESSION_DOMAIN=.yourdomain.com` — works because it's not a public suffix.
- Switch from cookie-based Sanctum SPA auth to **token-based (Bearer) auth**, which
  works across independent domains since it doesn't rely on cookie readability at
  all — but this is a real auth architecture change (client-side token storage, manual
  header attachment, losing Sanctum's built-in CSRF protection), not a config tweak.
