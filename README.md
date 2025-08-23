# Apex Grid

Next.js App Router project using SQLite via Prisma. Data lives in `prisma/dev.db`. Inspections are independent from Transformers.

## Prerequisites

- Node.js 18+ (20+ recommended)
- pnpm (preferred)
  - If needed: `npm i -g pnpm`

## Install

- Install dependencies: `pnpm install`

## Database (SQLite + Prisma)

- Schema: `prisma/schema.prisma` with SQLite at `prisma/dev.db` (no `.env` required for local).
- First-time setup and migration:
  - `pnpm run db:setup`
    - Runs `prisma generate` and `prisma migrate dev --name init`
- Useful commands:
  - `pnpm run prisma:studio` — open Prisma Studio
  - `pnpm run db:reset` — reset the dev DB and re-apply migrations (destructive)

## Run (development)

- Start dev server: `pnpm run dev`
- Open <http://localhost:3000>

Auth:

- Log in with `user1`..`user5` using the same value as password (e.g., `user3`/`user3`).
- On first login with one of these, the user record is auto-created in the DB via `/api/login`.

## Project structure (high-level)

- `app/` — App Router routes and API handlers
  - `app/api/transformers` and `app/api/inspections` — CRUD endpoints using Prisma
  - `app/api/login` — simple username/password login for dev
- `components/` — UI components (including sidebar and modals)
- `lib/prisma.ts` — Prisma client singleton
- `prisma/` — Prisma schema, migrations, and the SQLite DB file
