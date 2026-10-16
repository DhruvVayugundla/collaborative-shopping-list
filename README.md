# Collaborative Shopping List

A shared shopping list for families, roommates and friends. Lists sync in real time across everyone who has access, and show the estimated total of what's left to buy.

Specs live in [`specs/`](specs/): start with [goal-spec.md](specs/goal-spec.md).

## Stack

- **Frontend** (`frontend/`): React 19, Vite, TypeScript, Tailwind CSS 4, React Router, TanStack Query, React Hook Form + Zod, socket.io-client
- **Backend** (`backend/`): Node, Express 5, Socket.IO, Prisma + SQLite, Zod, JWT in an httpOnly cookie

## Getting started

Requires Node 20.19+.

```bash
npm install
cp backend/.env.example backend/.env     # then set a long random JWT_SECRET
npm run db:migrate -w backend            # creates backend/prisma/dev.db
npm run dev                              # API on :4000, web on http://localhost:5173
```

In dev, Vite proxies `/api` and `/socket.io` to the API, so the browser sees a single origin and the auth cookie works for both.

To try collaboration locally, open the app in two browser profiles (or one normal and one private window), register two users, and add the second user to a list by username.

## Scripts (from the repo root)

| Command | What it does |
|---|---|
| `npm run dev` | Run API and web dev servers together |
| `npm test` | Backend API + realtime tests, then frontend unit tests |
| `npm run build` | Type-check and build both workspaces |
| `npm start` | Apply migrations and start the production server (serves `frontend/dist` too) |

## Deploying

`npm run build && npm start` with `NODE_ENV=production`. That runs one Node process serving both the API and the built frontend.

SQLite is a file, so the host must have a **persistent disk** (Railway volume, Fly.io volume, Render disk) and `DATABASE_URL` should point to it, e.g. `file:/data/app.db`. To move to Postgres later, change `provider` in [schema.prisma](backend/prisma/schema.prisma) and regenerate migrations.

| Variable | Description |
|---|---|
| `PORT` | HTTP port (default 4000) |
| `DATABASE_URL` | Prisma SQLite URL, relative to `backend/prisma/` |
| `JWT_SECRET` | Secret used to sign session tokens (16+ chars) |
| `NODE_ENV` | `development`, `test` or `production` (production sets the `Secure` cookie flag) |
