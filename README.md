# Apex Grid

Next.js App Router project using SQLite via Prisma. Data lives in `prisma/dev.db`. The sidebar is global (left toggle). Inspections are independent from Transformers.

## Prerequisites

- Node.js 18+ (20+ recommended)
- Any package manager (examples use npm; Windows PowerShell friendly)

## Install

- Install dependencies: `pnpm install` (or `npm install`)

## Database (SQLite + Prisma)

- Schema: `prisma/schema.prisma` with SQLite at `prisma/dev.db`.
- First-time setup and migration:
  - `pnpm run db:setup` (or `npm run db:setup`)
    - Runs `prisma generate` and `prisma migrate dev --name init`
- Useful commands:
  - `pnpm run prisma:studio` (or `npm run prisma:studio`) — open Prisma Studio
  - `pnpm run db:reset` (or `npm run db:reset`) — reset and re-seed the DB (destructive for dev DB)

## Run (development)

- Start dev server: `pnpm run dev` (or `npm run dev`)
- Open <http://localhost:3000>

Login: use `user1`..`user5` with the same value as password (e.g., `user3`/`user3`).
On first login with one of these, the user record is auto-created in the DB.

## Project structure (high-level)

- `app/` — App Router routes and API handlers
  - `app/api/transformers` and `app/api/inspections` — CRUD endpoints using Prisma
- `components/` — UI components (including sidebar and modals)
- `lib/prisma.ts` — Prisma client singleton
- `prisma/` — Prisma schema, migrations, and the SQLite DB file

## Production notes

- SQLite is ideal for local/dev. For production, point Prisma to a server DB and run `prisma migrate deploy`.
- Build/start: `pnpm run build` then `pnpm run start` (or `npm run build` / `npm start`).

## Troubleshooting

- If Prisma complains about the client, run `pnpm run prisma:generate` (or `npm run prisma:generate`).
- If migrations fail after schema edits, run `pnpm run db:reset` (or `npm run db:reset`) — dev only.
