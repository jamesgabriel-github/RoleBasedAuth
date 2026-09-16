# Plan: Native Python Desktop Client (Messaging + Video Calling)

## Context

The user wants a **native Python desktop application** that is a real desktop client of the existing product — the same `client`/`admin`/`super_admin` users log in with their own credentials and get messaging + video/voice calling, backed by the same Laravel API and realtime infrastructure the React SPA already uses. This is not a bot/service account; it's an additional client surface for real end users, so it needs full login, conversation/message UI, and call UI, not a limited service integration.

Investigation of the existing Laravel 13 (`backend/`) + React 19/TS (`frontend/`) app found messaging and 1:1 video/voice calling already fully implemented, using self-hosted **Laravel Reverb** (Pusher-protocol WebSocket server) for realtime push and pure browser-to-browser **WebRTC** for call media — SDP/ICE signaling happens entirely via Reverb private-channel "client events" (whisper), never touching a REST endpoint or the database (`frontend/src/features/videoCall/hooks/useCallChannel.ts`). A desktop client must replicate this exact signaling flow, not invent a new one, so it interoperates with existing browser users unchanged.

Two backend facts are central to what needs to change:

1. **No token-issuance exists today.** `backend/app/Http/Controllers/Api/Auth/LoginController.php` only does `Auth::attempt()` + session regeneration — it's cookie/session auth for the browser SPA, full stop. A desktop app has no cookie jar/CSRF context the way a browser does, so it needs a **Bearer token** issued at login instead. This is the one genuinely new backend capability this plan requires.
2. **`/broadcasting/auth` currently only accepts session-cookie auth.** Confirmed in `backend/bootstrap/app.php`: `withRouting(channels: ...)` registers the broadcasting-auth route under Laravel/Reverb's default `web`-only middleware group. A Bearer-token-authenticated desktop client would get `Auth::user() === null` there and fail to subscribe to any private channel (`conversation.{id}`, `user.{id}`, `call.{id}` — all gated via `Gate::forUser($user)->check(...)` in `backend/routes/channels.php`). This must be fixed for the desktop app's realtime messaging and call signaling to work at all.

By contrast, messaging/calls being strictly 1:1 at the schema level (`conversations.user_one_id/user_two_id`, `calls.caller_id/callee_id` in `backend/app/Models/Conversation.php` / `Call.php`) is **not a constraint for this use case** — a desktop user is just another real participant, exactly like a browser user, so no schema changes are needed there.

## Recommended Approach

### 1. Backend: token issuance on login

`personal_access_tokens` migration and `HasApiTokens` on `User` already exist — nothing to install. Modify `LoginController::store` to branch using Sanctum's own frontend-detection helper (`Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::fromFrontend($request)`, confirmed present and public/static in `vendor/laravel/sanctum`):

- If the request **is** from the configured stateful frontend (browser SPA, matched by Origin/Referer against `SANCTUM_STATEFUL_DOMAINS`) — behavior is byte-for-byte unchanged: session-only, no token.
- If it **isn't** (the desktop app, which sends no browser Origin/Referer) — additionally call `$user->createToken('desktop-app')->plainTextToken` and include it in the JSON response alongside the existing `UserResource`.

Mirror the same branch in `LoginController::destroy`: if `$request->user()?->currentAccessToken()` is a real `PersonalAccessToken` (token auth), delete that token; otherwise keep the existing session-invalidate/regenerate logic for the SPA. This keeps one endpoint serving both clients correctly rather than duplicating login routes.

### 2. Backend: fix `/broadcasting/auth` for Bearer-token clients

In `backend/bootstrap/app.php`, replace the `channels:` param on `withRouting()` with an explicit `->withBroadcasting()` call carrying both middlewares:
```php
->withRouting(
    web: __DIR__.'/../routes/web.php',
    api: __DIR__.'/../routes/api.php',
    commands: __DIR__.'/../routes/console.php',
    health: '/up',
)
->withBroadcasting(
    __DIR__.'/../routes/channels.php',
    ['middleware' => ['web', 'auth:sanctum']],
)
```
`web` first (keeps session/cookie stack for the SPA's existing CSRF-cookie authorizer flow in `frontend/src/lib/echo.ts` working unchanged), `auth:sanctum` appended so a Bearer-token request that doesn't match a stateful domain still resolves `$user`. No change needed to `backend/routes/channels.php` — its Gate checks work identically once `$user` resolves, since a desktop user is a normal participant row.

### 3. Backend: nothing else required
No new role, no new migration, no new seeder — desktop users are the exact same accounts as browser users. OAuth login (Google/Facebook/GitHub) and in-app registration are **not** part of this plan's MVP — OAuth via desktop needs a system-browser + local-callback or custom-URI-scheme flow, meaningfully more work, called out as a later phase.

### 4. New Python desktop app — `desktop/` at repo root (sibling to `backend/`/`frontend/`)
Keep in-repo since it must track the backend's exact JSON/event contracts.

- **GUI**: PySide6 (official Qt for Python bindings, LGPL — preferred over PyQt6's GPL/commercial licensing for an app without a stated license stance).
- **Async bridge**: Qt's event loop isn't asyncio, but the realtime WebSocket client and `aiortc` both are. Use `qasync` to run one asyncio-integrated event loop for the whole app instead of juggling threads.
- **REST**: `httpx` client carrying `Authorization: Bearer <token>` (from the login response above), wrapping every existing endpoint (`/api/login`, `/api/user`, `/api/conversations`, `/api/conversations/{id}/messages`, `/api/conversations/{id}/calls`, `/api/calls/{id}/{accept,decline,cancel,end,timeout}`).
- **Realtime**: a **custom minimal Pusher-protocol-7 client over `websockets`**, not `pysher` — `pysher` is subscribe/listen-only with no way to *send* `client-*` whisper events, which call signaling requires. Connects to Reverb, authorizes private channels by POSTing to `/broadcasting/auth` with the Bearer header (mirroring `frontend/src/lib/echo.ts`'s authorizer), subscribes to `user.{id}` / `conversation.{id}` / `call.{id}`, and can whisper `signal` payloads on `call.{id}` matching the exact shapes in `frontend/src/features/videoCall/types.ts` (`{type:'offer'|'answer', sdp, fromUserId}`, `{type:'ice-candidate', candidate, fromUserId}`).
- **Self-echo handling**: the frontend's axios client attaches the Echo connection's `X-Socket-Id` header to REST requests so Laravel's `broadcast(...)->toOthers()` correctly excludes the sender's own realtime connection. The desktop `api_client.py` must do the same — read the socket id from the Pusher client's `pusher:connection_established` payload and send it as `X-Socket-Id` on REST calls — otherwise the desktop app will receive its own sent messages back over the socket and needs to dedupe them.
- **WebRTC**: `aiortc` for `RTCPeerConnection`, mirroring `frontend/src/features/videoCall/hooks/useWebRTCPeerConnection.ts` 1:1 — offer/answer creation, ICE candidate exchange with the same pending-candidate-queue-until-remote-description-set behavior, and the same caller-creates-offer-only-after-status-`ongoing` / callee-creates-answer-on-offer flow as `CallContext.tsx`'s phase state machine (idle/outgoing/incoming/active).
- **Media**: camera/mic capture and outgoing track via `aiortc.contrib.media` (or OpenCV/PyAV-backed custom `VideoStreamTrack` for more UI control over the camera preview); incoming remote `VideoFrame`s converted to `QImage`/`QPixmap` and rendered into a Qt video widget.
- **Module layout**: `desktop/config.py`, `desktop/api_client.py`, `desktop/auth/session.py` (login/logout, token persisted via OS keyring — the `keyring` package — so the user isn't forced to re-login every launch), `desktop/realtime/pusher_client.py`, `desktop/realtime/channels.py`, `desktop/webrtc/peer.py`, `desktop/webrtc/media.py`, `desktop/calling/call_manager.py` (mirrors `CallContext.tsx`'s state machine), `desktop/ui/{login_window,main_window,incoming_call_dialog,call_window}.py`, `desktop/main.py`.
- **Windows feasibility**: unlike a server-side deployment, PySide6 and `aiortc` (via `PyAV`) both publish prebuilt Windows wheels, so this should install and run natively on Windows (`pip install pyside6 aiortc qasync httpx websockets keyring`) without needing Docker/WSL2. Still worth a Phase 0 spike to confirm on the actual target Python version before building the rest, since PyAV's Windows wheel coverage varies by Python/OS version.
- **TURN**: no self-hosted TURN/SFU exists today (STUN-only, plus a free third-party TURN referenced in frontend env files). Same-LAN desktop↔browser or desktop↔desktop testing can likely get away with STUN; anything crossing real NATs will need a TURN server (self-hosted `coturn` recommended) — infra work, not app code, flagged for the media phase.

## Phased Sequencing

1. **Phase 0 — Feasibility spike**: confirm `pyside6` + `aiortc` + `qasync` install and coexist on the target Windows Python version; a bare Qt window with a live local camera preview, no backend involved yet.
2. **Phase 1 — Auth**: `LoginController` token-issuance branch + `/broadcasting/auth` middleware fix (both backend changes land together since realtime depends on the fix regardless). Desktop: `LoginWindow` + `api_client.py` that logs in, stores the token (keyring), calls `GET /api/user` to confirm identity. Verify: log in from the desktop app with a real seeded user's credentials, confirm `GET /api/user` returns that user's own `UserResource`, and confirm the browser SPA's own login/logout is completely unaffected.
3. **Phase 2 — Messaging over REST**: conversation list + message thread UI (cursor-paginated fetch matching the `before` param pattern), send via REST. Verify against an existing browser session on a different account — messages sent from desktop appear (after refresh) in the browser, and vice versa.
4. **Phase 3 — Realtime messaging**: `pusher_client.py`, `X-Socket-Id` header wiring, live push into the desktop UI. Verify: browser sends a message live, desktop receives it without polling; desktop sends one, browser receives it live; confirm desktop doesn't double-render its own sent message.
5. **Phase 4 — Call lifecycle (no media)**: `calling/call_manager.py` over REST, subscribing to `user.{id}` for `call.invited` and `call.{id}` for `call.status-changed`; incoming-call dialog, outgoing-call UI. Verify: browser calls desktop user and vice versa, accept/decline/cancel/end all flip state correctly with no media yet.
6. **Phase 5 — WebRTC media**: `webrtc/peer.py`, `webrtc/media.py`, wired into the call manager matching the exact signaling flow. Verify: a real two-way audio/video call between a browser tab and the desktop app (and desktop-to-desktop if testing with two accounts), checking `chrome://webrtc-internals` on the browser side and aiortc connection-state logs on the desktop side.
7. **Phase 6 (follow-on, not MVP)**: OAuth login via desktop (system-browser + callback handling), in-app registration, self-hosted TURN for cross-NAT reliability, token persistence hardening.

## Critical Files
- `backend/app/Http/Controllers/Api/Auth/LoginController.php` — token-issuance branch (core new backend logic)
- `backend/bootstrap/app.php` — `/broadcasting/auth` middleware fix
- `backend/routes/channels.php` — verified unchanged, Gate-based, works once auth resolves
- `backend/routes/api.php` — full list of REST endpoints the desktop client wraps
- `frontend/src/lib/echo.ts` — private-channel authorizer pattern to mirror with Bearer auth
- `frontend/src/features/videoCall/hooks/useCallChannel.ts`, `useWebRTCPeerConnection.ts`, `CallContext.tsx`, `types.ts` — exact whisper payload shapes and signaling/phase flow the desktop client must replicate
- `frontend/src/features/messaging/` (`api.ts`, `hooks/useMessages.ts`, `hooks/useConversationChannel.ts`) — REST + realtime patterns to mirror for the desktop message thread
- New: `desktop/` (Python app root)

## Verification Summary
Each phase has its own end-to-end cross-client check (desktop login confirmed against `GET /api/user` → REST message round-trip with the browser → realtime message round-trip → call state machine without media → real audio/video call between browser and desktop), so the desktop client is validated incrementally against the real, already-working browser app rather than only at the very end.
