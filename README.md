# Collaborative Shopping List

A shared shopping list for families, roommates and friends. Everyone on a list sees changes the moment they happen. Who added what, what's already bought, and the estimated cost of what's left are all in one place, so nobody buys the milk twice.

## Features

- **Shared lists:** create a list and add people by username; they get access immediately.
- **Real-time sync:** items added, edited, ticked off or removed appear for every member without a refresh.
- **Items with cost:** name, quantity and an estimated per-unit price; the list shows the total and the amount still to buy (in ₹).
- **Owner and member roles:** members manage items; only the owner can rename or delete the list and manage members. Members can leave a list.
- **AI quick-add (optional):** paste a list from WhatsApp, like "2kg rice, a dozen eggs, surf excel ~250, bread x2", and an LLM turns it into items. You review and edit them before anything is saved.
- **Works on phone and desktop:** responsive layout built mobile-first.

## Tech stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4, React Router 7, TanStack Query, React Hook Form + Zod, socket.io-client |
| Backend | Node.js, Express 5, Socket.IO, Prisma 6 + SQLite (Turso in production), Zod |
| Auth | Username + password (bcrypt), JWT in an httpOnly cookie, shared by REST and WebSocket |
| AI | Groq (`openai/gpt-oss-120b`) with strict JSON-schema output |
| Tests | Vitest, Supertest, socket.io-client |

## How it works

```
Browser (React SPA)
   │  REST  /api/v1/*        ── mutations, initial data
   │  Socket.IO /socket.io   ── live updates
   ▼
Express + Socket.IO (one Node process)
   ├─ checks list membership on every request and on every room join
   ├─ writes to SQLite through Prisma
   ├─ after each successful write, broadcasts the change to the list's room
   └─ AI quick-add: free text → Groq → validated draft items (saved only after review)
```

Every change goes through the REST API; the WebSocket only carries updates out to the other members. If two people edit the same item at once, the last write wins, and everyone ends up seeing the same final state. After a reconnect, the client re-joins the list's room and refetches the list, so it catches up on anything it missed.

## Getting started

**Requirements:** Node.js 22.12+ and npm.

```bash
git clone https://github.com/DhruvVayugundla/collaborative-shopping-list.git
cd collaborative-shopping-list
npm install
cp backend/.env.example backend/.env
npm run db:migrate -w backend     # creates the SQLite database
npm run dev                        # API on :4000, app on http://localhost:5173
```

Before going beyond local testing, replace `JWT_SECRET` in `backend/.env` with a long random value:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Trying collaboration locally:** open the app in two browser profiles (or a normal and a private window), register two users, and add the second user to a list by username. Changes in one window show up in the other.

### Enabling AI quick-add (optional)

1. Create a key at [console.groq.com/keys](https://console.groq.com/keys).
2. Add it to `backend/.env`:
   ```
   GROQ_API_KEY=gsk_...
   ```
3. Restart `npm run dev`. A **✨ Paste a list** button appears under the add-item form.

Without a key, the app works normally and the button is hidden. Only the pasted text is sent to Groq. Each user can run 20 parses per 10 minutes.

> **Note:** variables already set in your system environment take precedence over `backend/.env`. If quick-add says "Couldn't read that list" even though your key is correct, check whether an old `GROQ_API_KEY` is set system-wide, remove it, and restart your terminal or editor.

## Configuration

All settings live in `backend/.env` (git-ignored; see [`backend/.env.example`](backend/.env.example)).

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | HTTP port (default `4000`) |
| `DATABASE_URL` | Yes | SQLite file URL, relative to `backend/prisma/` (e.g. `file:./dev.db`) |
| `JWT_SECRET` | Yes | Secret for signing session tokens, at least 16 characters |
| `NODE_ENV` | No | `development` (default), `test` or `production` (production sets the `Secure` cookie flag) |
| `TURSO_DATABASE_URL` | No | Use a hosted Turso database instead of the local SQLite file (production) |
| `TURSO_AUTH_TOKEN` | With Turso | Auth token for the Turso database |
| `GROQ_API_KEY` | No | Enables AI quick-add |
| `GROQ_MODEL` | No | Groq model for quick-add (default `openai/gpt-oss-120b`; must support strict structured outputs, e.g. `openai/gpt-oss-20b`) |

## Scripts

Run these from the repository root.

| Command | What it does |
|---|---|
| `npm run dev` | Starts the API and the web app together, with reload |
| `npm test` | Runs the backend tests (API, permissions, realtime, AI routes), then the frontend unit tests |
| `npm run build` | Type-checks and builds both workspaces |
| `npm start` | Applies database migrations and starts the production server |

The tests use a separate throwaway database and never call Groq: the AI module is mocked.

## Project structure

```
backend/
  prisma/          schema + migrations
  src/
    routes/        auth, lists, members, items (incl. AI parse + bulk add)
    realtime/      Socket.IO auth, rooms, broadcasts
    ai/            Groq call, prompt, output validation
    services/      access checks, serialization, totals
  test/            API, permission, realtime and AI tests
frontend/
  src/
    pages/         login/register, lists overview, list detail
    components/    item form and row, members panel, quick-add panel, layout
    api/           fetch client, query hooks, cache updaters
    realtime/      socket connection, per-list live updates
specs/             goal, frontend, backend and API contract specs
```

## Documentation

The design is documented in [`specs/`](specs/):

- [goal-spec.md](specs/goal-spec.md): problem, users, scope and success metrics
- [frontend-spec.md](specs/frontend-spec.md): pages, components, state and real-time behaviour
- [backend-spec.md](specs/backend-spec.md): data model, permissions, real-time sync, AI quick-add, security
- [api-contract-spec.md](specs/api-contract-spec.md): every REST endpoint, error code and Socket.IO event

## Deployment

The app runs as a single Node process that serves both the API and the built frontend (`npm run build`, then `npm start` with `NODE_ENV=production`). On startup, `npm start` applies any pending database migrations.

### Free hosting: Render + Turso

Render's free tier has no persistent disk, so in production the data lives in [Turso](https://turso.tech), a hosted SQLite-compatible database with a free plan. Local development and the tests keep using the plain SQLite file. The setup is described in [`render.yaml`](render.yaml).

1. **Turso:** sign up, create a database, then copy its URL (`libsql://…`) and create an auth token.
2. **Render:** sign up with GitHub, choose **New → Blueprint**, and select this repository. Render reads `render.yaml` and asks for:
   - `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` from step 1
   - `GROQ_API_KEY` (optional; leave it blank to hide AI quick-add)

   `JWT_SECRET` is generated for you.
3. Render builds and deploys the app to `https://<service-name>.onrender.com`. Every push to `main` redeploys it.

**Free-tier limits to know about:**
- The service sleeps after 15 minutes without visitors, and the first visit after that takes about a minute to wake it.
- Render gives 750 free instance-hours a month.
- Rate-limit counters reset whenever the service restarts.

### Other hosts

Without `TURSO_DATABASE_URL`, the app uses the SQLite file at `DATABASE_URL`, so any host with a **persistent disk** works (for example a Railway volume, Fly.io volume or Render paid disk), with `DATABASE_URL` pointing at it (e.g. `file:/data/app.db`). To switch to PostgreSQL later, change `provider` in [`schema.prisma`](backend/prisma/schema.prisma) and regenerate the migrations.

### Windows note

`npm run build` runs `prisma generate`, which fails with `EPERM` if `npm run dev` is running: Windows locks a Prisma engine file while the server has it loaded. Stop the dev server before building.
