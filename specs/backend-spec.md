# Backend Spec — Collaborative Shopping List

> Status: Implemented (MVP) | Owner: <!-- name --> | Last updated: 2026-10-16
> Related: [goal-spec.md](./goal-spec.md) · [api-contract-spec.md](./api-contract-spec.md)

## 1. Tech Stack
- **Runtime / Language:** Node.js (20.19+) + TypeScript
- **Framework:** Express 5 (async handler errors reach the error middleware automatically)
- **Database:** SQLite (file-based). Deploy only to a host with a persistent disk (e.g. Railway volume, Fly.io volume, Render disk). Can move to PostgreSQL later by changing the Prisma `provider`.
- **ORM / Query layer:** Prisma 6 (schema + `prisma migrate`)
- **Real-time transport:** Socket.IO, attached to the same HTTP server as Express
- **Cache / Pub-Sub:** None for MVP (single instance)
- **Auth:** bcryptjs password hashing + JWT stored in an httpOnly, SameSite=Lax cookie; the same cookie authenticates the Socket.IO handshake
- **Validation:** Zod (request bodies and socket payloads)
- **Testing:** Vitest + Supertest (API) + socket.io-client (realtime)

## 2. Architecture Overview
```
HTTP request → helmet / json / cookie-parser → /api/v1 router
   → requireAuth (JWT cookie → req.user)
   → route handler: Zod parse → access check (services/access.ts) → Prisma → serialize
   → realtime.toList / toUsers (broadcast after the write succeeds)
   → JSON response   (errors → errorHandler → standard error JSON)

Socket.IO connection → cookie JWT check → auto-join user:<id>
   → list:join (membership check) → join list:<id>
```
In production, the same Express app serves `frontend/dist` with an SPA fallback, so one process serves everything.

## 3. Data Model
### Entities
#### User
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String (UUID) | PK | |
| username | String | unique | Stored lowercase, `[a-z0-9_]{3,30}` |
| passwordHash | String | | bcrypt, cost 10 |
| createdAt | DateTime | default now | |

#### ShoppingList
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String (UUID) | PK | |
| name | String | 1–100 chars | |
| ownerId | String | FK → User, cascade | |
| createdAt / updatedAt | DateTime | | `updatedAt` changes on rename |

#### ListMember
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| listId | String | PK part, FK → ShoppingList, cascade | |
| userId | String | PK part, FK → User, cascade | |
| role | String | `"owner"` \| `"member"` | Owner also has a row, so access checks are one lookup |
| addedAt | DateTime | default now | |

#### Item
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String (UUID) | PK | |
| listId | String | FK → ShoppingList, cascade | |
| name | String | 1–100 chars | |
| quantity | Int | 1–9999 | default 1 |
| estimatedPriceCents | Int | 0–100,000,000 | Per-unit price in minor units (paise) to avoid float rounding |
| purchased | Boolean | default false | |
| createdById | String | FK → User | |
| createdAt / updatedAt | DateTime | | |

### Relationships
- User 1—N ShoppingList (owner); User N—M ShoppingList through ListMember; ShoppingList 1—N Item.
- Deleting a list cascades to its members and items.

### Indexes
- `User.username` (unique), `ShoppingList.ownerId`, `ListMember.userId` (lists for a user), `Item.listId`.

## 4. Business Logic & Rules
- **List ownership & roles:** The creator is the owner. Everyone else is a member.
- **Sharing:** The owner adds a registered user by username, with immediate access (no accept step). Adding an existing member → 409. Unknown username → 404.
- **Leaving / removal:** The owner can remove any member. A member can remove themselves (leave). The owner can't leave and must delete the list instead.
- **Item lifecycle:** created (pending) ⇄ purchased → deleted. Any member can do any of these.
- **Budget calculation:** `total = Σ quantity × estimatedPriceCents`. `pending` is the same sum over unpurchased items. Computed on read (`GET /lists`) and on the client for the detail view; never stored.
- **Validation rules:** See `src/validation.ts`. Names are trimmed, and usernames are lowercased so login is case-insensitive.

## 5. Authentication & Authorization
- **Auth method:** Username + password → JWT (`sub` = user id, `username`), HS256 with `JWT_SECRET`.
- **Token lifecycle:** 7-day expiry, in an httpOnly cookie `token` (`SameSite=Lax`, `Secure` in production). Logout clears the cookie. No refresh tokens in MVP.
- **Permission matrix:**

| Action | Owner | Member | Non-member |
|--------|-------|--------|------------|
| View list | ✅ | ✅ | 404 |
| Add/edit/delete/mark item | ✅ | ✅ | 404 |
| Rename list | ✅ | 403 | 404 |
| Delete list | ✅ | 403 | 404 |
| Add/remove members | ✅ | 403 | 404 |
| Leave list | ❌ (400) | ✅ | 404 |

Non-members get 404 (not 403) so the existence of a list isn't revealed.

## 6. Real-Time Sync
- **Mechanism:** Socket.IO. The client connects once after login, and the JWT cookie is verified in the connection middleware.
- **Rooms / channels:** `list:<listId>` per list (the server checks membership before letting a socket join) and `user:<userId>` per user (joined automatically).
- **Event broadcasting rules:** Mutations go through REST. After a successful DB write, the server broadcasts the full updated entity to the list's room. Changes that affect someone's lists overview (added, removed, rename, delete) also emit `lists:changed` to their user room. A removed member's sockets are forced out of the list room.
- **Conflict resolution strategy:** Last-write-wins. Each update overwrites, and the broadcast carries the final state. The client ignores events older than its cached version.
- **Scaling across instances:** Single instance for MVP. Add the Socket.IO Redis adapter if scaling out is ever needed.

## 6a. AI Quick-Add
- **What:** `POST /lists/:listId/items/parse` sends the user's free text to an LLM on Groq and returns draft items without saving them. The client shows the drafts for review, then saves them with `POST /lists/:listId/items/bulk` (one transaction, one `item:created` broadcast per item).
- **Model & call:** `groq-sdk`, `client.chat.completions.create` with `GROQ_MODEL` (default `openai/gpt-oss-120b`), `reasoning_effort: "low"` (simple extraction, so speed matters), and strict structured outputs (`response_format: json_schema`, `strict: true`). The JSON is still re-parsed with Zod. Code: `src/ai/parseItems.ts`.
- **Prompt rules:** Extract only what the user wrote (no suggestions). Counts become integer quantity ("a dozen eggs" → 12). Weights and volumes stay in the name ("Rice (2 kg)"). Price only when stated, in rupees per unit. The user's text is wrapped in `<list>` tags and treated as data.
- **Output safety:** The model output is re-validated (`normalizeDrafts`): names trimmed/non-empty, quantity clamped to 1–9999, rupees converted to paise, at most 50 items. Bulk save re-validates everything with the normal item schema.
- **Cost controls:** 2000-char input cap, 4000 max completion tokens, 20 parses per user per 10 min.
- **Off switch:** Without `GROQ_API_KEY` the feature is off: `/features` reports `aiQuickAdd: false`, the UI hides it, and parse returns 503.
- **Errors:** Groq rate-limit/server error → 503 `AI_UNAVAILABLE`; other API errors or output that fails validation → 502 `AI_ERROR`.
- **Privacy:** The pasted text (only that, with no user or list data) goes to Groq; the UI says so.

## 7. Error Handling & Logging
- **Error format:** `{ error: { code, message, details } }`, see [api-contract-spec.md](./api-contract-spec.md#2-standard-error-response). Zod errors → 400 with `details.issues`. Prisma unique violations → 409. Malformed JSON → 400.
- **Logging:** Unexpected errors are logged with `console.error`, and the client gets a generic 500.
- **Monitoring:** Health check at `GET /api/v1/health`.

## 8. Security
- Input validation / sanitization: Zod on every body and socket payload; React escapes output; JSON body limit 100 kB.
- Rate limiting: `express-rate-limit` on `/auth/*`: 30 requests / 15 min / IP.
- CORS: Not enabled. The app is same-origin (Vite proxy in dev, Express serves the build in prod).
- Secrets management: `JWT_SECRET` from the environment (`.env` locally, git-ignored); config is validated at startup.
- Other: `helmet` default headers; passwords hashed with bcrypt; httpOnly cookie protects the token from XSS; SameSite=Lax limits CSRF.

## 9. Configuration / Environment Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | HTTP port | `4000` |
| `DATABASE_URL` | SQLite file URL (relative to `prisma/`) | `file:./dev.db` |
| `JWT_SECRET` | Token signing secret, ≥ 16 chars | long random string |
| `NODE_ENV` | `development` \| `test` \| `production` | `production` |
| `GROQ_API_KEY` | Optional; enables AI quick-add | `gsk_...` |
| `GROQ_MODEL` | Groq model with strict structured outputs | `openai/gpt-oss-120b` |

## 10. Testing Strategy
- **Unit / Integration:** `test/auth.test.ts`, `test/lists.test.ts` (Supertest against the Express app: auth flow, permission matrix, item CRUD, validation, totals)
- **AI quick-add:** `test/ai.test.ts` (AI module mocked, Groq never called): normalizer, parse validation/membership/errors, bulk create + broadcast, features flag
- **Realtime:** `test/realtime.test.ts` (real server + socket.io-client: handshake auth, room membership, broadcasts, no events after removal)
- **Test DB:** A fresh `prisma/test.db` built from the migrations at the start of each run
- **Load:** Not in MVP

## 11. Deployment
- **Environments:** local dev; one production instance on a host with a persistent volume
- **CI/CD:** Not set up yet. Suggested: `npm ci && npm test && npm run build` on push.
- **Migrations:** `prisma migrate dev` locally; `npm start` runs `prisma migrate deploy` before boot.

## 12. Folder Structure
```
backend/
  prisma/schema.prisma, migrations/
  src/
    index.ts         http server + Socket.IO
    app.ts           Express app (exported for tests), prod static serving
    config.ts        env validation
    db.ts            Prisma client
    errors.ts        AppError + error middleware
    validation.ts    Zod schemas
    auth/            jwt.ts, password.ts, middleware.ts
    routes/          auth.ts, lists.ts, members.ts, items.ts, params.ts
    services/        access.ts (membership/role checks), serialize.ts (DTOs, totals)
    realtime/        socket.ts (auth, rooms, broadcast helpers)
    ai/              parseItems.ts (Groq call, prompt, output normalization)
  test/
```

## 13. Open Questions
- [ ] Should list `updatedAt` also change on item edits (to sort recently active lists first)?
- [ ] Account deletion and password change (post-MVP)
