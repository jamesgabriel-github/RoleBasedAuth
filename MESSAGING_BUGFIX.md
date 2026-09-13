# Bugfix: Unread Message Counter Resetting on Reload

## Symptom
On the Messages page, opening a conversation correctly cleared its unread badge/dot in the UI, but reloading the page brought the unread state right back — as if the conversation had never been read.

## Root cause
`App\Http\Resources\ConversationResource` takes a custom second constructor argument:

```php
public function __construct($resource, protected ?int $viewerId = null)
```

`ConversationController::index()` (the endpoint the frontend calls to list conversations) built the response with:

```php
ConversationResource::collection($conversations)
```

Laravel's `JsonResource::collection()` maps the underlying Eloquent collection into resources via `Collection::mapInto($class)`, which internally does:

```php
new $class($value, $key)
```

— passing the **array index** of each conversation (0, 1, 2, …) as the second constructor argument. Our custom constructor interpreted that index as `$viewerId`, silently replacing the real authenticated user's id.

Once `$viewerId` was wrong, `ConversationResource::countUnreadFor()` broke in two ways at once:
- `->where('sender_id', '!=', $viewerId)` no longer matched the real user, so the sender exclusion stopped filtering anything.
- `$this->participants->firstWhere('user_id', $viewerId)` found no matching participant, so `last_read_at` resolved to `null` and the read-cutoff filter was skipped.

The combined effect: for most conversations, the unread count fell back to the **total message count** in the conversation, regardless of actual read state. (A conversation could look correct by pure coincidence if its array index happened to equal a real user id who also happened to be a participant — which briefly masked the bug in one of the two test conversations.)

This only affected the list endpoint (`GET /api/conversations`). Anywhere else in the code that constructed `ConversationResource` directly with an explicit id (e.g. `ConversationController::store()`, the `ConversationUpdated` broadcast event) was unaffected, which is why the bug looked inconsistent/hard to pin down.

## Fix
**`backend/app/Http/Controllers/Api/Messaging/ConversationController.php`** — `index()` now builds the resource collection explicitly instead of relying on the vulnerable `::collection()` helper:

```php
$resources = $conversations->map(fn (Conversation $conversation) => new ConversationResource($conversation, $userId));

return response()->json(['conversations' => $resources]);
```

This guarantees every `ConversationResource` receives the real authenticated user's id, not a loop index.

## Related hardening fixes made along the way
While tracing this, two smaller (real, but not the root cause) issues were also fixed:

1. **`backend/app/Http/Controllers/Api/Messaging/ReadReceiptController.php`** — marking a conversation read used a blind `->where('user_id', ...)->update(...)`, which would silently no-op (still returning HTTP 200) if a `conversation_participants` row didn't exist for that user/conversation pair. Changed to `updateOrCreate` so it self-heals instead of failing silently:
   ```php
   $conversation->participants()->updateOrCreate(
       ['user_id' => $request->user()->id],
       ['last_read_at' => $readAt],
   );
   ```
2. **`frontend/src/features/messaging/components/MessageThread.tsx`** — the mark-as-read call (`markConversationRead(conversationId).then(onRead)`) had no `.catch()`, so a failed PATCH request (network error, auth issue) would fail completely silently. Added error logging on failure.

---

# Secondary bugfix: Message input field not clearing after send

## Symptom
When sending a message, the input field remained filled with the text after clicking Send. The message never appeared in the thread, and no error was visible to the user.

## Root cause
`MessageController::store()` created new messages without explicitly setting the `type` field:
```php
$message = $conversation->messages()->create([
    'sender_id' => $sender->id,
    'body' => $body,
]);
```
The `messages` table schema has `type` as `string default('text')`, but Eloquent's `create()` method doesn't reflect database-level column defaults back into the in-memory PHP model object — it only populates columns from the data you explicitly pass. So `$message->type` remained `null` in memory.

Then `MessageResource::toArray()` (line 22) immediately crashed trying to access `$this->type->value` on the null enum, producing a 500 Internal Server Error. The frontend's `sendMessage()` function never caught this error (no `.catch()` handler), so the promise rejection was never handled and `setBody('')` was never called.

## Fix
**`backend/app/Http/Controllers/Api/Messaging/MessageController.php`** — `store()` method now explicitly sets `'type' => MessageType::Text` on creation:
```php
$message = $conversation->messages()->create([
    'sender_id' => $sender->id,
    'type' => MessageType::Text,
    'body' => $body,
]);
```
Also updated `index()` method to include the `call` relation: `.with(['sender', 'call'])` to support call-log messages.

## Verification
- Tested with Playwright browser automation: logged in, opened a conversation, sent a message, confirmed 201 Created response + input field cleared + message visible in thread.
- Ran 5 consecutive send-and-clear cycles successfully.

---

## Verification (unread counter fix)
- Confirmed via `php artisan tinker`, simulating both the broken (`::collection()`) and fixed (`->map()`) code paths directly, that the broken path produced `viewer_id` values of `0` and `1` (matching array position) instead of the real user id `7`, while the fixed path correctly resolved `unreadCount: 0` for both conversations after they'd been read.
- Confirmed in-browser: reloading the Messages page after the fix keeps previously-read conversations marked as read (no badge/dot), instead of resetting to unread.
