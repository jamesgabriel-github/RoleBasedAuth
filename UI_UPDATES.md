# Mobile Responsiveness Updates

Mobile-viewport support for the logged-in dashboard area (Overview, Messages, Admin accounts). Frontend-only, no backend changes. Scope was explicitly limited to the dashboard area — the public landing page, login/register, and OAuth callback pages are unchanged.

## Problem
- The sidebar nav (`Sidebar.tsx`) was `hidden` below the `md` (768px) breakpoint with **no replacement** — on a phone, the Overview/Messages/Admin accounts links were completely inaccessible.
- The Messages page rendered a fixed 320px conversation list next to the open thread with no responsive fallback, so both were squeezed side-by-side on a ~375px screen.

## Mobile navigation — hamburger + slide-in drawer
- Added shadcn's `Sheet` component (`frontend/src/components/ui/sheet.tsx`, via `npx shadcn@latest add sheet`).
- **`frontend/src/features/dashboard/navLinks.ts`** (new) — the nav link list (Overview/`LayoutGrid`, Messages/`MessageCircle`, Admin accounts/`ShieldCheck`, with role gating) moved here so the desktop sidebar and the new mobile drawer share one source of truth instead of duplicating it.
- **`frontend/src/features/dashboard/components/MobileNav.tsx`** (new) — a controlled `Sheet` (`open`/`onOpenChange` props) sliding in from the left, rendering the same links; each link is wrapped in `SheetClose` so tapping it navigates and auto-closes the drawer.
- **`TopNav.tsx`** — added a `Menu` icon button (`md:hidden`, only visible below the `md` breakpoint) that opens the drawer via a new `onMenuClick` prop. Everything else in the header (logo, avatar dropdown) is unchanged.
- **`DashboardShell.tsx`** — now owns the drawer's open/closed state (`useState`) and renders `MobileNav` alongside the existing desktop `Sidebar`; also reduced `main`'s padding on small screens (`p-4 sm:p-6`) to give content more room on a phone.

## Messages — single-column list ↔ thread navigation
Instead of a permanent side-by-side split, mobile now shows one panel at a time:
- **`MessagesPage.tsx`** — uses `useMatch('/messages/:conversationId')` to detect whether a conversation is open. The conversation list gets `hidden md:flex` once a conversation is selected; the thread/outlet panel is `hidden md:flex` until one is. At `md` and above, both panels are always shown side-by-side exactly as before.
- **`ConversationList.tsx`** — gained an optional `className` prop so `MessagesPage` can control this visibility; the list is full width on mobile (`w-full`) and fixed at 320px (`md:w-80`) on larger screens.
- **`MessageThread.tsx`** — added a back button (`ChevronLeft`, `md:hidden`) at the start of the thread header that navigates back to `/messages`. Also fixed a real overflow risk this surfaced: the conversation partner's name/email column had no truncation, so a long name could push the video-call button off-screen once the back button took up extra space — it now truncates properly (`min-w-0 flex-1 overflow-hidden` + `truncate`).

## Minor polish
- **`UserSearchCombobox.tsx`** — the "New message" search popover's fixed `w-80` became `w-[calc(100vw-2rem)] sm:w-80`, so it no longer crowds a 375px screen edge-to-edge.

## Left as-is (not broken, out of scope)
- `DashboardPage.tsx` / `StatCard.tsx` were already responsive (`sm:flex-row`, `sm:grid-cols-3/2`) from the earlier redesign — no changes needed.
- The admin tables (`AdminAccountsTable.tsx`, `LoggedInClientsTable.tsx`) already scroll horizontally on narrow screens via the shared `table.tsx` wrapper. That's an accepted, common pattern for data tables — restyling them into stacked cards would be a separate, larger redesign not requested here.
- `RegisterForm.tsx`'s two-column name/password grids are a known gap but belong to the out-of-scope login/register page.

## Verification
- `npm run lint` and `npx tsc -b` — no new warnings or type errors.
- `npm run build` — clean production build.
- Manually driven with Playwright against the real dev stack at two viewports:
  - **375×667 (mobile)**: hamburger opens the drawer, navigating via it closes the drawer; Messages shows only the conversation list, tapping a conversation switches to a full-width thread with a working back button and no text overflow.
  - **1400×900 (desktop)**: confirmed pixel-identical to the pre-change layout — sidebar visible, hamburger hidden, Messages list and thread shown side-by-side.
