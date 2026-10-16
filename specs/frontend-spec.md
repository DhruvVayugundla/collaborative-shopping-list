# Frontend Spec — Collaborative Shopping List

> Status: Implemented (MVP) | Owner: <!-- name --> | Last updated: 2026-10-16
> Related: [goal-spec.md](./goal-spec.md) · [api-contract-spec.md](./api-contract-spec.md)

## 1. Tech Stack
- **Framework:** React 19 (single-page app, no SSR)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4 (mobile-first utilities for responsive layout)
- **State management:** TanStack Query cache for server state, including the current user (`["me"]`); local `useState` for UI state. No separate global store.
- **Data fetching / caching:** TanStack Query over `fetch` with `credentials: "include"` (cookie auth)
- **Real-time client:** socket.io-client, connected with `withCredentials: true`; incoming events update the TanStack Query cache
- **Routing:** React Router 7 (protected routes redirect to `/login`)
- **Forms & validation:** React Hook Form + Zod
- **Testing:** Vitest (unit tests for cache updaters, totals and money parsing)
- **Build tooling:** Vite 8

## 2. Pages / Routes
| Route | Page | Auth required | Description |
|-------|------|---------------|-------------|
| `/` | — | — | Redirects to `/lists` |
| `/login` | AuthPage (login) | No | Username + password login; redirects back to the page the user came from |
| `/register` | AuthPage (register) | No | Create an account; logs in immediately |
| `/lists` | ListsPage | Yes | Create a list; "My lists" and "Shared with me" with item count, bought count and total |
| `/lists/:listId` | ListDetailPage | Yes | Items, add/edit/remove, purchased toggle, members, totals; live updates |
| `*` | NotFound | No | Link back to lists |

## 3. Component Breakdown
| Component | Responsibility | Key props / state |
|-----------|----------------|-------------------|
| `ProtectedRoute` | Auth gate; connects/disconnects the socket; refetches lists on `lists:changed` | `useMe()` |
| `Layout` | Header (brand, username, log out) + "Reconnecting…" banner | `user` |
| `AuthPage` | Login / register form | `mode` |
| `ListsPage` / `ListCard` / `NewListForm` | List overview and creation | `useLists()` |
| `ListDetailPage` / `ListHeader` | Loads a list, subscribes to its room, owner rename/delete | `useList(id)`, `useListSocket(id)` |
| `ItemForm` | Add or edit an item (name, qty, price each) | `initial`, `onSubmit`, `resetOnSuccess` |
| `ItemRow` | Purchased checkbox, line total, inline edit, delete | `item` |
| `MembersPanel` | Member list; owner adds by username / removes; member leaves | `list`, `myUserId` |
| `TotalBar` | Sticky bottom bar: estimated total and still-to-buy amount | totals |
| `Feedback` | Spinner, error box, inline error | — |

## 4. UI / UX Requirements
- **Design system / theme:** Tailwind, slate neutrals + emerald accent; shared class strings in `src/lib/ui.ts`
- **Responsive breakpoints:** Mobile-first single column, max width 672px (`max-w-2xl`); usable from 320px wide
- **Accessibility (WCAG level):** Target AA: labelled inputs (visually hidden labels where needed), `role="alert"` for errors, `aria-live` totals, visible focus rings
- **Empty / loading / error states:** Every list/query view has all three; errors offer "Try again"
- **Currency:** INR via `Intl.NumberFormat("en-IN")` (one constant in `src/lib/format.ts`)

## 5. State Management
- **Global state:** Current user = query `["me"]` (`null` when logged out). Any 401 sets it to `null`, which redirects to `/login`.
- **Server state:** `["lists"]` (summaries), `["list", id]` (detail with items and members)
- **Local/UI state:** Form inputs, edit mode per row/header
- **Optimistic updates:** Only the purchased toggle; rolled back to the previous snapshot on error. Other mutations update the cache from the server response.

## 6. Real-Time Behavior
- **Events subscribed to:** `item:created`, `item:updated`, `item:deleted`, `member:added`, `member:removed`, `list:updated`, `list:deleted` (per list room) and `lists:changed` (per user). See [api-contract-spec.md](./api-contract-spec.md#5-real-time-events).
- **Conflict handling on client:** All updates go through pure updaters in `src/api/cache.ts`. Upserts are idempotent (own echoes are harmless) and ignore an item version older than the cached one (`updatedAt`).
- **Presence indicators:** Not in MVP.
- **Reconnect / offline behavior:** Socket.IO reconnects automatically. On every (re)connect the page re-joins the list room and refetches the list, so missed events are recovered. A banner appears after 1.5s offline. Removal or deletion redirects to `/lists` with a notice.

## 7. Authentication Flow
Register or log in → the server sets an httpOnly `token` cookie → the `["me"]` cache is populated → protected routes render and the socket connects. On load, `GET /auth/me` decides whether the user is logged in. Log out → `POST /auth/logout`, the cache is cleared, the socket disconnects. The token is never readable by JavaScript.

## 8. Key User Flows
### Flow 1: Create and share a list
1. On `/lists`, type a name and press Create; the app navigates to the new list.
2. In Members, type a registered username and press Add.
3. The other user's lists page updates live and shows the list under "Shared with me".

### Flow 2: Mark item as purchased
1. Tick the checkbox on an item. It is struck through and moves below pending items immediately.
2. Other members see the same change; "still to buy" decreases.

## 9. Validation Rules (client-side)
| Field | Rule | Error message |
|-------|------|---------------|
| Username | 3–30 letters, digits or `_` | 3-30 characters: letters, numbers or underscores |
| Password | 8–72 characters | At least 8 characters / At most 72 characters |
| List name | 1–100 characters | (button disabled when empty) |
| Item name | 1–100 characters | Enter an item name |
| Quantity | Whole number 1–9999 | Whole number, 1-9999 |
| Price | Empty or non-negative with ≤ 2 decimals | Enter a price like 45 or 45.50 |

The server re-validates everything; its messages are shown inline when it rejects input.

## 10. Error Handling
- **Network errors:** `api()` maps fetch failures to "Can't reach the server"; queries retry once for network/5xx errors, never for 4xx.
- **API error display:** The server's `error.message` is shown next to the form or action that failed.
- **Session expiry:** Any 401 (REST) or a rejected socket handshake clears the current user and redirects to `/login`.

## 11. Performance Targets
- Initial JS ≈ 150 kB gzipped; interactions update from cache without refetching.

## 12. Testing Strategy
- **Unit:** `src/api/cache.test.ts` (idempotent and stale-safe upserts, totals, sorting, money parsing)
- **Integration:** Covered by the backend API + Socket.IO tests
- **E2E:** Manual two-browser checklist in the README (Playwright can be added later)

## 13. Folder Structure
```
frontend/
  src/
    api/         client.ts (fetch wrapper), hooks.ts (queries/mutations), cache.ts (+ test)
    auth/        ProtectedRoute.tsx
    realtime/    socket.ts (shared connection), useListSocket.ts
    pages/       AuthPage, ListsPage, ListDetailPage
    components/  Layout, ItemForm, ItemRow, MembersPanel, Feedback
    lib/         format.ts (currency), ui.ts (class strings)
    types.ts, App.tsx, main.tsx, index.css
```

## 14. Open Questions
- [ ] Add a confirmation/undo for item deletion?
- [ ] Presence ("Bob is viewing") post-MVP?
