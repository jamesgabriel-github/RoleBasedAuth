# Messaging Implementation Summary

Real-time, plain-text direct messaging layered onto the existing auth/role system (see [CLAUDE.md](./CLAUDE.md) and [AUTH_FLOW_GUIDE.md](./AUTH_FLOW_GUIDE.md)). Client ↔ client, admin/super_admin ↔ client, and admin/super_admin ↔ admin/super_admin conversations are supported; discovery is asymmetric (clients can only search other clients by email; admins/super_admins can search anyone), but once a conversation exists either side can reply regardless of role. Media/attachments are explicitly out of scope for now.

Transport is **Laravel Reverb** (self-hosted, Pusher-protocol-compatible WebSocket server) + **Laravel Echo**/`pusher-js` on the frontend — chosen because this stack has no other third-party services and Reverb needs no external account.

## Backend (`backend/`)

### Broadcasting setup
- `composer require laravel/reverb` + `php artisan install:broadcasting --reverb`, which on Laravel 13 wires broadcasting via `bootstrap/app.php`'s `withRouting(channels: ...)` — **no `BroadcastServiceProvider` file exists**, this version registers `/broadcasting/auth` and loads `routes/channels.php` directly from that call.
- `config/cors.php` — the installer does **not** add `/broadcasting/auth` to the CORS `paths` allowlist. Since the SPA calls it cross-origin (`localhost:5173` → `localhost:8000`), this silently breaks channel auth in a real browser (request goes out but the browser blocks the response for missing CORS headers). Fixed by adding `'broadcasting/auth'` to `config/cors.php`'s `paths` array.
- `/broadcasting/auth` ends up under the default **`web`** middleware group (not `auth:sanctum`) — this is actually correct here: `web` already includes `StartSession`/`EncryptCookies`, so the existing `laravel-session` cookie authenticates the request the same way any traditional session-based route would; no Sanctum stateful wrapping is needed for it.
- The installer also scaffolded Laravel's default Blade/Vite Echo boilerplate (`backend/resources/js/echo.js`, an edit to `app.js`, npm deps in `backend/package.json`) — all reverted, since this backend is pure API (per CLAUDE.md) and the real frontend lives in `frontend/`.
- New `.env` keys: `BROADCAST_CONNECTION=reverb`, `REVERB_APP_ID` / `REVERB_APP_KEY` / `REVERB_APP_SECRET` / `REVERB_HOST` / `REVERB_PORT` / `REVERB_SCHEME` (mirrored in `frontend/.env` as `VITE_REVERB_*`).
- Local dev needs two extra long-running processes beyond `php artisan serve`: `php artisan reverb:start` (the WebSocket server) and `php artisan queue:work` (broadcasts are queued — see below).

### Database
- `conversations` — `user_one_id`/`user_two_id` (FKs to `users`, always stored with `user_one_id < user_two_id`), `last_message_id` (nullable FK to `messages`, added in a follow-up migration since it forward-references a not-yet-created table), `last_message_at`. Unique on `(user_one_id, user_two_id)` — this is what makes conversation lookup/creation an idempotent `firstOrCreate`.
- `conversation_participants` — pivot carrying **per-user** `last_read_at` (unread tracking needs a read timestamp per participant, not per conversation). Unique on `(conversation_id, user_id)`.
- `messages` — `conversation_id`, `sender_id`, `body` (text), indexed on `(conversation_id, created_at)` for paginated history.
- Models: `App\Models\Conversation` (`userOne()`, `userTwo()`, `participants()`, `messages()`, `lastMessage()`, `otherParticipant(int $userId)`), `ConversationParticipant`, `Message`. `User` gains `conversations(): BelongsToMany` through the pivot. All three new models need `#[Fillable([...])]` (this app uses PHP attributes instead of `$fillable` properties) — missing it throws `MassAssignmentException` on `firstOrCreate`/`create`/`update`.

### Authorization — the `Gate::before` carve-out
`AppServiceProvider` previously bypassed **every** ability for `super_admin`:
```php
Gate::before(fn (User $user, string $ability) => $user->role === UserRole::SuperAdmin ? true : null);
```
Conversations are meant to be strictly private — even for `super_admin` — so the closure now checks the ability's target model and refuses to bypass for `Conversation`, forcing a real policy check every time:
```php
Gate::before(function (User $user, string $ability, array $arguments = []) {
    if (($arguments[0] ?? null) instanceof Conversation) {
        return null; // never bypass — force ConversationPolicy to decide
    }
    return $user->role === UserRole::SuperAdmin ? true : null;
});
```
`App\Policies\ConversationPolicy` (`view`, `send`, both just check participant membership) is picked up by Laravel's standard auto-discovery — no `AuthServiceProvider` exists in this app, so no explicit `Gate::policy()` registration was needed. Verified end-to-end: a super_admin gets a real `403` opening a conversation they're not part of, both via `GET /api/conversations/{id}/messages` and via `/broadcasting/auth` for that conversation's channel.

### Endpoints (`App\Http\Controllers\Api\Messaging\*`, added to `routes/api.php` inside the existing `auth:sanctum + account.active` group)
- `GET /api/messaging/users/search?email=` — `UserSearchController`. Clients are filtered to `role = client`; admins/super_admins get no role filter. Postgres `ILIKE`, `take(10)`, no pagination — this is a debounced typeahead, not a browsable list.
- `POST /api/conversations` — `ConversationController::store`. Get-or-create, idempotent regardless of which side calls it or the order of the two user IDs. **Re-checks the same client/non-client restriction server-side** — the search endpoint is discovery UX only, never the authorization boundary (verified: a client `POST`ing an admin's `user_id` directly, bypassing the UI, gets a `422`).
- `GET /api/conversations` — list, with `otherUser`, `lastMessage` preview, and `unreadCount` per conversation.
- `GET /api/conversations/{conversation}/messages` — paginated history (`Gate::authorize('view', ...)` first).
- `POST /api/conversations/{conversation}/messages` — send (`Gate::authorize('send', ...)` first, `body` max 5000 chars, plain text only).
- `PATCH /api/conversations/{conversation}/read` — marks the current user's `last_read_at`.

No new spatie permission was added for the search/messaging restriction — it's a fixed role rule, not an admin-configurable capability, so it's a plain `$user->isClient()` check in the controller (same style as the existing hard business-rule checks in `UserStatusController`).

### Broadcasting events & channels
- `App\Events\MessageSent` (`ShouldBroadcast`, queued — not `ShouldBroadcastNow`, since `QUEUE_CONNECTION=database` already exists for exactly this) broadcasts a `MessageResource` on `private-conversation.{id}`.
- `App\Events\ConversationUpdated` broadcasts a `ConversationResource` on `private-user.{recipientId}` — needed so the recipient's conversation list (unread badge, last-message preview) updates live even when they don't have that specific conversation open/subscribed.
- `routes/channels.php` — `conversation.{id}` authorization routes through `Gate::forUser($user)->check('view', $conversation)` (honoring the carve-out above); `user.{id}` just checks `$user->id === $userId`.
- **`ConversationResource` takes an explicit `?int $viewerId` constructor arg** rather than always reading `$request->user()->id` — a queued broadcast job has no real authenticated HTTP request, so the "who is this conversation summary being rendered for" context has to be passed in directly for `ConversationUpdated`. For the plain `index()` listing endpoint (which does run inside a real request), `viewerId` is left `null` and it falls back to `$request->user()->id` as normal.

### Manual test-account changes (local dev DB only)
While verifying this end-to-end with curl (two real cookie-based sessions), the seeded client accounts (`james1@gmail.com`, `james.g@agentsofvalue.com`) and the super admin account had their passwords set to a known value (`password123`) since the originals weren't available — their original passwords are gone; reset them if that matters. A temporary second admin account used to verify admin↔admin messaging, and all test conversations/messages, were deleted afterward.

## Frontend (`frontend/`)

### Realtime client
- `src/lib/echo.ts` — singleton Echo instance (`broadcaster: 'reverb'`), `connectEcho()`/`disconnectEcho()`. Uses a **custom `authorizer`** that POSTs to `/broadcasting/auth` through the app's existing `apiClient` (so it carries the same cookie/XSRF wiring as every other request) rather than Echo's default fetch config, which doesn't know about this app's CSRF setup. Wired into `AuthContext.tsx`: connects when `user` becomes truthy, disconnects when it becomes `null` — covers login, logout, and bootstrap uniformly from one effect.
- Echo/Pusher's `authorizer` callback signature is `(error: Error | null, authData: ChannelAuthorizationData | null) => void`, **not** `(boolean, data)` — easy to get backwards since some older examples online use the boolean form.

### Feature structure
```
src/features/messaging/
  api.ts                          searchMessageableUsers, listConversations, getOrCreateConversation,
                                   listMessages, sendMessage, markConversationRead
  types.ts                        Message, ConversationSummary, PaginatedMessages
  MessagingContext.tsx             shares one conversation-list fetch + one `user.{id}` channel
                                   subscription between the Sidebar (unread badge) and the Messages
                                   page — avoids duplicate fetches/sockets if both mounted `useConversations()` independently
  hooks/
    useConversations.ts            list + unread total; skips fetching entirely while logged out
                                   (MessagingProvider wraps the whole app, including the public/login pages)
    useMessages.ts                 paginated history + live-append via the conversation channel
    useConversationChannel.ts      subscribes to `private-conversation.{id}`, listens for `.message.sent`
    useUserChannel.ts              subscribes to `private-user.{id}`, listens for `.conversation.updated`
  components/
    ConversationList.tsx, ConversationListItem.tsx, MessageThread.tsx,
    MessageBubble.tsx, MessageComposer.tsx, UserSearchCombobox.tsx

src/pages/MessagesPage.tsx         layout: ConversationList + <Outlet context={...}/>, route `/messages`
src/pages/ConversationPage.tsx     reads conversationId param + outlet context, route `/messages/:conversationId`
```
- Router (`routes/router.tsx`): `/messages` and `/messages/:conversationId` as nested routes inside the existing `ProtectedRoute`, with **no `RequireRole`** — every role uses messaging.
- Sidebar gains a "Messages" link with an unread-count `Badge`, sourced from `MessagingContext` (not a fresh `useConversations()` call, to avoid the duplicate-subscription problem above).
- New shadcn components: `scroll-area`, `textarea`, `skeleton`, `popover`. Deliberately skipped `command`/`cmdk` for the email-search typeahead — a plain `Input` + `Popover` + mapped result list matches this app's existing complexity for a bounded 10-row search better than a command-palette abstraction.

## Bugs found and fixed during implementation/testing
1. **Missing `#[Fillable]` on `Conversation`/`ConversationParticipant`** — `firstOrCreate()` threw `MassAssignmentException` until added (this app uses PHP attributes, not `$fillable` arrays, easy to forget on a brand-new model).
2. **`ConversationResource` reading `$request->user()->id`** — worked fine for the `index()` HTTP endpoint but broke for the `ConversationUpdated` broadcast event, which runs inside a queued job with no real authenticated request. Fixed by accepting an explicit `viewerId` constructor argument.
3. **CORS allowlist gap** — `install:broadcasting` doesn't add `/broadcasting/auth` to `config/cors.php`'s `paths`, which would have silently broken the SPA's cross-origin channel authorization in a real browser (the request would succeed server-side but the browser would reject the response for missing `Access-Control-Allow-Origin`).
4. **Unused Vite/Blade Echo scaffolding** — the broadcasting installer generated `backend/resources/js/echo.js` and edited `app.js`/`package.json` as if this were a traditional Laravel+Vite app; reverted since the actual frontend is the separate `frontend/` SPA.
5. **Pusher `authorizer` callback signature** — initially implemented as `(error: boolean, data) => void`; the actual pusher-js type is `(error: Error | null, authData) => void`. Caught by checking the installed package's `.d.ts` rather than assuming from memory.
6. **False alarm: broadcast jobs "randomly" missing** — during manual testing, `MessageSent`/`ConversationUpdated` jobs appeared to vanish silently (no entry in `jobs` or `failed_jobs`). Root cause was **not** application code: an earlier failed test script had backgrounded `php artisan serve`/`reverb:start`/`queue:work` with a shell `&` that didn't actually die when the wrapping tool call exited, leaving duplicate processes running — two `queue:work` instances were each grabbing one of the two jobs per message send and logging to separate output files. Killed the duplicates, restarted one clean instance of each, and every subsequent send produced both jobs reliably.
7. **TypeScript: narrowing lost across a nested closure** — in `ConversationPage.tsx`, `if (!conversation) return; function handleRead() { ...conversation... }` didn't preserve the `if`-guard's narrowing inside the nested function body (TS treats it as still possibly `undefined`). Fixed by re-binding the narrowed value to a separately, explicitly-typed `const` right after the guard.

## Verified end-to-end
Using two real authenticated cookie sessions (curl, matching the SPA's `Origin`/`X-XSRF-TOKEN` requirements) against a live `serve` + `reverb:start` + `queue:work`: client↔client, admin↔client, and admin↔admin conversations all create and exchange messages; a client's direct `POST /api/conversations` with an admin's `user_id` (bypassing the UI) is rejected with `422`; replying to an already-existing conversation works regardless of role; a super_admin gets `403` both reading messages and authorizing the WebSocket channel for a conversation they're not in; unread counts increment and clear correctly; repeated `POST /api/conversations` calls (either ordering of the two user IDs) return the same conversation. The frontend was **not** exercised in an actual browser — `tsc -b` and `oxlint` are clean, but a manual click-through is still worth doing.

## Manual steps still required
- **Run it**: four processes — `php artisan serve`, `php artisan reverb:start`, `php artisan queue:work`, and `npm run dev` — all at once.
- **Reset test account passwords** (`james1@gmail.com`, `james.g@agentsofvalue.com`, `superadmin@example.com`) if the originals matter to you; see the note above.
- **Click through the actual UI** in a browser with two sessions to confirm the realtime updates, unread badge, and email-search combobox behave as expected — this was verified at the API level only.
