# API Contract Spec — Collaborative Shopping List

> Status: Implemented (MVP + AI quick-add) | Owner: <!-- name --> | Last updated: 2026-10-17
> Version: v1
> Related: [frontend-spec.md](./frontend-spec.md) · [backend-spec.md](./backend-spec.md)

## 1. Conventions
- **Base URL:** `/api/v1`
- **Format:** JSON
- **Auth:** httpOnly, SameSite cookie `token` (JWT), set on login/register and cleared on logout. No `Authorization` header; clients send requests with credentials included.
- **Naming:** camelCase
- **Timestamps:** ISO 8601 UTC strings
- **IDs:** UUID strings (Prisma `@default(uuid())`)
- **Money:** Integer minor units (`estimatedPriceCents`, paise for INR). The client formats for display.
- **Pagination:** None in MVP (lists and items per list are small).

## 2. Standard Error Response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Quantity must be at least 1",
    "details": { "issues": [{ "path": "quantity", "message": "Quantity must be at least 1" }] }
  }
}
```
| HTTP status | Code | Meaning |
|-------------|------|---------|
| 400 | `VALIDATION_ERROR` | Invalid body, malformed JSON, or a disallowed action (owner leaving) |
| 401 | `UNAUTHENTICATED` | Missing/invalid/expired cookie, or wrong username/password |
| 403 | `FORBIDDEN` | Member attempting an owner-only action |
| 404 | `NOT_FOUND` | Unknown route/list/item/user, or not a member of the list |
| 409 | `CONFLICT` | Username taken, or user already a member |
| 429 | `RATE_LIMITED` | Too many auth attempts or AI parses |
| 500 | `INTERNAL` | Unexpected server error |
| 502 | `AI_ERROR` | The AI couldn't parse the text (API error or invalid output) |
| 503 | `AI_UNAVAILABLE` | AI quick-add not configured, or Groq is rate-limited/overloaded |

## 3. Shared Schemas
### User
```json
{ "id": "uuid", "username": "alice", "createdAt": "2026-10-16T10:00:00.000Z" }
```
### ShoppingList (summary, from `GET /lists`)
```json
{
  "id": "uuid", "name": "Weekly groceries", "role": "owner",
  "owner": { "id": "uuid", "username": "alice" },
  "memberCount": 2, "itemCount": 5, "purchasedCount": 2,
  "totalCents": 84500, "pendingCents": 40000,
  "createdAt": "…", "updatedAt": "…"
}
```
### ShoppingList (detail, from `GET /lists/:listId`)
```json
{
  "id": "uuid", "name": "Weekly groceries", "ownerId": "uuid", "role": "member",
  "items": [Item], "members": [Member],
  "createdAt": "…", "updatedAt": "…"
}
```
### Member
```json
{ "userId": "uuid", "username": "bob", "role": "member", "addedAt": "…" }
```
### Item
```json
{
  "id": "uuid", "listId": "uuid", "name": "Milk", "quantity": 2,
  "estimatedPriceCents": 3200, "purchased": false,
  "createdBy": { "id": "uuid", "username": "alice" },
  "createdAt": "…", "updatedAt": "…"
}
```

## 4. REST Endpoints

### Auth
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/auth/register` | Body `{username, password}` → `201 {user}` + sets cookie. 409 if taken. | No |
| POST | `/auth/login` | Body `{username, password}` → `200 {user}` + sets cookie. 401 if wrong. | No |
| POST | `/auth/logout` | Clears cookie → `204` (works even with an expired cookie) | No |
| GET | `/auth/me` | → `200 {user}`, or 401 | Yes |

Username: 3–30 of `[a-zA-Z0-9_]` (stored lowercase). Password: 8–72 chars.

### Lists
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/lists` | Lists the user owns or is a member of → `{lists: [Summary]}`, most recently updated first | Yes |
| POST | `/lists` | Body `{name}` → `201 {list: Summary}` | Yes |
| GET | `/lists/:listId` | → `{list: Detail}` (items oldest first, members by join date) | Member |
| PATCH | `/lists/:listId` | Body `{name}` → `{list: {id, name, updatedAt}}` | Owner |
| DELETE | `/lists/:listId` | Deletes list, items and memberships → `204` | Owner |

### Members / Sharing
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/lists/:listId/members` | Body `{username}` → `201 {member}`. 404 unknown user, 409 already a member. | Owner |
| DELETE | `/lists/:listId/members/:userId` | Remove a member (owner), or leave (your own id) → `204`. Owner leaving → 400. | Owner / self |

### Items
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/lists/:listId/items` | Body `{name, quantity?=1, estimatedPriceCents?=0}` → `201 {item}` | Member |
| PATCH | `/lists/:listId/items/:itemId` | Partial body of `{name, quantity, estimatedPriceCents, purchased}` (≥ 1 field) → `{item}` | Member |
| DELETE | `/lists/:listId/items/:itemId` | → `204` | Member |

Item constraints: name 1–100 chars, quantity integer 1–9999, price integer 0–100,000,000.

### AI quick-add
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/lists/:listId/items/parse` | Body `{text}` (1–2000 chars) → `{items: [{name, quantity, estimatedPriceCents}]}` (≤ 50 drafts). **Saves nothing.** Rate limit: 20 per user per 10 min. | Member |
| POST | `/lists/:listId/items/bulk` | Body `{items: [{name, quantity?, estimatedPriceCents?}]}` (1–50, same constraints as single items) → `201 {items: [Item]}`. All or nothing; emits one `item:created` per item. | Member |

### Health & features
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/health` | → `{ok: true}` | No |
| GET | `/features` | → `{aiQuickAdd: boolean}` (true when the server has a Groq API key) | No |

## 5. Real-Time Events
- **Transport:** Socket.IO
- **Connection URL & auth:** Same origin as the API server (default Socket.IO path `/socket.io`); authenticated by the `token` cookie during the handshake. An invalid or missing token rejects the connection with `connect_error` message `UNAUTHENTICATED`.
- **Subscription model:** Each socket automatically joins `user:<userId>`. The client asks to join `list:<listId>`, and the server allows it only for list members. After a successful join, the client should refetch the list to cover anything missed before joining.

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `list:join` | `{listId}` + ack | Ack `{ok: true}` or `{ok: false, error: "NOT_FOUND" \| "VALIDATION_ERROR"}` |
| `list:leave` | `{listId}` | Stop receiving the list's events |

### Server → Client
| Event | Room | Payload | Description |
|-------|------|---------|-------------|
| `item:created` | `list:<id>` | `{listId, item}` | Item added |
| `item:updated` | `list:<id>` | `{listId, item}` | Any item field changed (full item) |
| `item:deleted` | `list:<id>` | `{listId, itemId}` | Item removed |
| `list:updated` | `list:<id>` | `{list: {id, name, updatedAt}}` | List renamed |
| `list:deleted` | `list:<id>` | `{listId}` | List deleted (room is then closed) |
| `member:added` | `list:<id>` | `{listId, member}` | Member added |
| `member:removed` | `list:<id>` | `{listId, userId}` | Member removed or left (their sockets are then removed from the room) |
| `lists:changed` | `user:<id>` | `{}` | Your lists overview changed (added/removed/renamed/deleted); refetch `GET /lists` |

Events are also delivered to the user who made the change. Clients apply them idempotently.

## 6. Rate Limits
| Scope | Limit |
|-------|-------|
| `/auth/*` per IP | 30 requests / 15 minutes (429 `RATE_LIMITED`) |
| `/lists/:listId/items/parse` per user | 20 requests / 10 minutes |
| Everything else | None in MVP |

## 7. Versioning & Changelog
| Version | Date | Changes |
|---------|------|---------|
| v1 | 2026-10-16 | Initial contract |
| v1 | 2026-10-17 | Added (non-breaking): `POST /lists/:listId/items/parse`, `POST /lists/:listId/items/bulk`, `GET /features`, error codes `AI_ERROR` / `AI_UNAVAILABLE` |

## 8. Open Questions
- [ ] Pagination if lists grow large
- [ ] Activity history events (post-MVP)
