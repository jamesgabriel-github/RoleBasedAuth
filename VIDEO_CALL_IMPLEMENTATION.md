# Video Call Implementation Summary

1:1 video calling added on top of the existing messaging system. Calls are restricted by role — **client ↔ client**, or **any staff pairing** (admin↔admin, admin↔super_admin, super_admin↔super_admin) — and are **never** allowed cross-tier (client↔admin, client↔super_admin). Every call is capped at exactly 2 participants, which falls out for free from reusing the existing 2-party `Conversation` model. No group calls, no TURN server (STUN-only for now), calls are started from an existing conversation thread only (no standalone call directory).

## Data model

- **`calls` table** (new) — `conversation_id`, `caller_id`, `callee_id`, `status`, `answered_at`, `ended_at`, `duration_seconds`. No separate participants table needed since a call always maps 1:1 onto its conversation's two users.
- **`App\Enums\CallStatus`** — `Ringing | Ongoing | Declined | Missed | Cancelled | Ended | Failed`.
- **`App\Models\Call`** — `conversation()`/`caller()`/`callee()` relations, `isParticipant()`, `otherParticipant()`.
- **Call history in the message thread** — `messages` gained a `type` column (`text` | `call_log`, default `text`) and a nullable `call_id` FK; `body` became nullable. A `call_log` message (no body, linked to the `Call` row) is created whenever a call reaches a terminal state, reusing the existing `Message`/`MessageSent`/`ConversationUpdated` plumbing unchanged — so it shows up as "Video call · 4m 12s" / "Missed video call" / etc. inline in the thread and as the conversation-list preview, exactly like a normal message.

## Backend authorization

- **`UserRole::canVideoCallWith()`** (`backend/app/Enums/UserRole.php`) — the eligibility rule (client-client, or staff-staff), deliberately separate from messaging's rule (where staff *can* message clients) rather than derived from it.
- **`App\Policies\CallPolicy`** — `view`, `initiate` (participant + role-eligibility check), `accept`/`decline`/`cancel`/`timeout`/`end`, each gated on the right participant and call status.
- **`AppServiceProvider::boot()` fix** — the existing `Gate::before` closure auto-grants `super_admin` every ability except when a `Conversation` is involved (so even super_admin can't peek into a chat they're not part of). Adding `Call` naively to that `instanceof` check on `$arguments[0]` would **not** have worked: verified directly against Laravel's `Gate::raw()` source that "create-style" authorization (`Gate::authorize('initiate', [Call::class, $conversation])`) passes the **raw, unstripped** arguments array to `before` callbacks, so `$arguments[0]` is the string `'App\Models\Call'`, not a model instance — the target `Conversation` sits at index 1. Fixed by scanning *all* arguments (`collect($arguments)->contains(...)`) instead of only index 0. Covered by a regression test asserting super_admin cannot bypass the cross-tier restriction.

## API & realtime signaling

- **Routes** (`backend/routes/api.php`): `POST /conversations/{conversation}/calls`, `POST /calls/{call}/{accept,decline,cancel,end,timeout}`.
- **`App\Http\Controllers\Api\Calling\CallController`** — `store()` does a `lockForUpdate()` busy check (409 if either participant already has a ringing/ongoing call) before creating the call; the four terminal actions share a `terminal()` helper that sets `ended_at`/`duration_seconds`, writes the `call_log` message, and broadcasts.
- **Channels** (`backend/routes/channels.php`): new `call.{callId}` private channel, gated the same way as `conversation.{id}` via `Gate::forUser($user)->check('view', $call)`.
- **Events** — `CallInvited` (→ `user.{calleeId}`, since the callee isn't on `call.{id}` yet) and `CallStatusChanged` (→ `call.{id}`, not `->toOthers()` since both sides need every transition). Both implement `ShouldBroadcastNow` (skip the queue) since ringing/hangup are latency-sensitive, unlike chat messages.
- **Signaling split**: call *lifecycle* (ring/accept/decline/cancel/end) is server-authoritative REST + DB + broadcast. SDP offers/answers and ICE candidates are relayed **peer-to-peer via Echo's `.whisper()`** on the private `call.{id}` channel — no backend code needed for that part beyond the channel's own auth callback, since Reverb accepts client events from private-channel members by default.

## Frontend

New `frontend/src/features/videoCall/` module, mirroring the `messaging` feature's shape:
- `types.ts` / `api.ts` / `utils.ts` (`canVideoCall()` mirrors the backend rule for UI gating only; `RTC_CONFIG` is STUN-only; `CALL_RING_TIMEOUT_MS` = 45s).
- `hooks/useWebRTCPeerConnection.ts` — wraps `RTCPeerConnection`/`getUserMedia`/ICE, buffering ICE candidates that arrive before the remote description is set.
- `hooks/useCallChannel.ts` / `hooks/useIncomingCallListener.ts` — Echo subscriptions following the existing `useConversationChannel`/`useUserChannel` ref-callback pattern.
- `CallContext.tsx` — app-level provider (`phase: idle | outgoing | incoming | active`) orchestrating the whole flow: initiate → ring timeout → accept → offer/answer/ICE exchange → active → hang up/decline/cancel/timeout, all funneled through a single `resetState()`.
- `components/CallButton.tsx` (in `MessageThread`'s header, hidden unless `canVideoCall()` and idle), `IncomingCallModal.tsx` (non-dismissable shadcn `Dialog`), `CallWindow.tsx` (full-screen video overlay with mute/camera/hang-up).
- Mounted globally in `App.tsx` (`CallProvider` + `IncomingCallModal` + `CallWindow` alongside `MessagingProvider`) so an incoming call rings no matter what route the user is on.
- **Fixed a latent bug while touching `user.{id}` subscriptions**: `laravel-echo`'s `Echo.leave()` has no reference counting, so `useUserChannel` (messaging) and the new `useIncomingCallListener` independently subscribing to/leaving the same `user.{id}` channel would race and tear down each other's listener. Added `frontend/src/lib/userChannel.ts` (`subscribeUserChannel`) — a small ref-counted wrapper — and routed both hooks through it.

## Bugs caught during verification (not in the original plan)

Automated tests run on sqlite; the app runs on Postgres in dev — two real bugs only surfaced when driving the actual stack:

1. **Missing eager-load before broadcast**: `CallController::accept()` and `terminal()` broadcast `CallStatusChanged($call)` before `caller`/`callee` were loaded on the model, so the websocket payload's `caller`/`callee` fields were malformed and the frontend crashed reading `.fullName` on `undefined`. Fixed by loading the relations before broadcasting, not just before building the HTTP response.
2. **Carbon 3 float duration**: `diffInSeconds()` now returns a float (fractional seconds) rather than an int. Postgres's `duration_seconds` integer column rejected it (`invalid input syntax for type integer`), causing every call-end request to 500 — sqlite silently tolerated the float, so the test suite never caught it. Fixed with `(int) round(...)`.

## Verification

- **22 PHPUnit tests** (`tests/Unit/Enums/UserRoleTest.php`, `tests/Feature/Calling/CallEligibilityTest.php`, `tests/Feature/Calling/CallLifecycleTest.php`) — every role-pair permutation including the super_admin bypass regression, full lifecycle (initiate/accept/end with duration + call-log assertions, decline, cancel, timeout), busy-conflict 409, non-participant 403.
- **Live two-browser smoke test** (Playwright, headless Chromium with fake camera/mic devices) driven against the real dev stack (Postgres, Reverb, queue worker, Vite): logged in as two separate client users, started a conversation, initiated a call, accepted it, confirmed live local+remote `<video>` elements and a running duration counter, hung up, and confirmed the "Video call · 0:05" log entry rendered correctly in both the thread and the conversation-list preview after a fresh page load.
- `php artisan test` and `tsc -b --noEmit` both clean (aside from one pre-existing, unrelated failing test that hits `/` on this API-only app).
