# Messaging Feature Updates

## 1. Fixed: Message thread overflowing its container

### Symptom
On the Messages page, the message thread panel (right side) would visually overflow past its rounded/bordered box — message bubbles spilled outside the container's corners instead of scrolling within it, and the whole page could end up needing its own scrollbar.

### Root cause
In a flex column layout, a flex child's default `min-height` is `auto`, not `0`. `MessageThread`'s `ScrollArea` (`flex-1 p-4`, no `min-h-0`/`overflow-hidden`) grew to fit however many messages existed instead of scrolling internally, pushing content past the parent's rounded border.

### Fix
- **`frontend/src/features/messaging/components/MessageThread.tsx`** — added `min-h-0` to the root flex container and to the `ScrollArea` itself, so it respects its allotted space and scrolls instead of growing.
- **`frontend/src/pages/MessagesPage.tsx`** — added `overflow-hidden` to the outer rounded box as a safety net, clipping any residual overflow to the rounded corners.

### Verification
Tested in-browser against a conversation with 20+ messages — scrolls cleanly within its box, no page-level scroll, composer stays anchored at the bottom.

---

## 2. Added: Lazy-loading / infinite scroll for message history

### Motivation
Opening a conversation previously fetched the first page of messages (30 items) via standard offset pagination, and there was no way to load older history beyond that — the loading infrastructure existed in the hook but was never wired to the UI. For long-running conversations, this doesn't scale well and doesn't let users scroll back through full history.

### What changed

**Backend — cursor-based pagination** (`backend/app/Http/Controllers/Api/Messaging/MessageController.php`):
Replaced Laravel's offset-based `paginate(30)` with a cursor query:
```php
$before = $request->integer('before'); // oldest currently-loaded message id, or null for first load

$query = $conversation->messages()
    ->with(['sender', 'call'])
    ->orderByDesc('id');

if ($before) {
    $query->where('id', '<', $before);
}

$messages = $query->limit($perPage + 1)->get(); // fetch one extra to detect hasMore
$hasMore = $messages->count() > $perPage;
$messages = $messages->take($perPage);
```
Response shape: `{ messages: { data: Message[], hasMore: boolean } }`.

**Why cursor-based instead of page numbers:** page-based pagination breaks when new messages arrive concurrently — a new message shifts every subsequent page's offset by one, causing older messages to be skipped or duplicated while a user scrolls back through history during an active chat. Cursor-based pagination (`WHERE id < :before`) is immune to this, and also avoids a `COUNT(*)` query since `hasMore` is derived from fetching one extra row instead of computing `last_page`.

Added a migration for a `(conversation_id, id)` composite index so the cursor query stays index-only.

**Frontend changes:**
- `frontend/src/features/messaging/types.ts` / `api.ts` — `PaginatedMessages` simplified to `{ data, hasMore }`; `listMessages()` takes an optional `before` cursor instead of a page number.
- `frontend/src/features/messaging/hooks/useMessages.ts` — `loadMore()` now uses the oldest currently-loaded message's id as the cursor, prepends the older batch, and guards against duplicate concurrent fetches via a new `loadingMore` flag.
- `frontend/src/components/ui/scroll-area.tsx` — added optional `viewportRef` and `onViewportScroll` passthrough props to the underlying Radix scroll viewport (purely additive; confirmed no other component in the codebase uses `ScrollArea`, so this is non-breaking).
- `frontend/src/features/messaging/components/MessageThread.tsx` — the actual wiring:
  - A scroll handler detects when the user nears the top of the thread and triggers `loadMore()`.
  - **Scroll-position preservation**: before prepending older messages, the current `scrollHeight` is captured; after the DOM updates, `scrollTop` is recalculated so the message the user was looking at stays visually anchored instead of the view jumping.
  - The previous unconditional "always scroll to bottom" effect was replaced with a single `useLayoutEffect` that distinguishes three cases: initial load (jump to bottom), a new message arriving while already near the bottom (auto-scroll), and older messages being prepended (restore position, never auto-scroll to bottom).
  - A small "Loading older messages…" indicator shows above the list while a `loadMore()` fetch is in flight.

### Behavior
- Initial load: fetches the most recent 30 messages only (not full history).
- Scrolling to the top fetches and prepends the next older batch, with the previously-visible message staying in the same position (no visual jump).
- Real-time incoming messages (via the existing websocket channel) still append normally; if the user is scrolled up reading history, new messages don't yank the view down — only auto-scrolls if already near the bottom.
- Once the full history is loaded (`hasMore: false`), no further requests fire even if the user keeps scrolling to the top.

### Verification
Tested end-to-end with a 32-message conversation: initial load rendered exactly 30 messages; scrolling to the top triggered exactly one additional request and loaded the remaining 2, with `scrollTop` confirmed non-zero after restoration (proving the anchor worked, not a jump-to-top); a second scroll-to-top attempt after exhausting history triggered no further requests.
