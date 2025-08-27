# Apex Grid

Next.js App Router frontend with a Spring Boot backend (preferred). Legacy Next.js API + Prisma/SQLite remains available for local only.

- Frontend: Next.js (App Router), React, Tailwind
- Backend: Spring Boot (Web, Data JPA, Security), H2 (in-memory/file) or your DB
- Images are saved as base64 strings in the database
- Inspections relate to Transformers and are cascade-deleted when a Transformer is removed

## Prerequisites

- Node.js 18+ (20+ recommended)
- pnpm (preferred)
  - If needed (one-time): `npm i -g pnpm`

## Quick start (with Spring backend)

1. Install frontend deps: pnpm install
1. Run the Spring Boot backend (defaults to <http://localhost:8080>). See `backend/README.md` for details
1. Create `.env.local` in the project root with: NEXT_PUBLIC_BACKEND_URL=<http://localhost:8080>
1. Start the Next.js dev server: pnpm run dev
1. Open <http://localhost:3000>

Notes

- All frontend API calls go to `${NEXT_PUBLIC_BACKEND_URL}/api/...` via `lib/api.ts`.
- If you change backend port/host, just update `NEXT_PUBLIC_BACKEND_URL`.

## Alternative: Legacy local API (Next.js + Prisma/SQLite)

You can still run the legacy API routes in Next.js backed by Prisma + SQLite.

1) Initialize the database: `pnpm run db:setup`
2) Start the dev server: `pnpm run dev`
3) Open <http://localhost:3000>

Details

- Schema: `prisma/schema.prisma`, DB file at `prisma/dev.db`
- Useful:
  - `pnpm run prisma:studio` — Prisma Studio
  - `pnpm run db:reset` — reset migrations (destructive)

## Auth

- Log in with `user1`..`user5` using the same value as the password (e.g., `user3`/`user3`).
- Backend handles user creation/verification on first successful login at `/api/login`.
- The UI shows “Logged in as username” and records `uploadedBy` for created/updated entities and images.

## Features

- Transformers and Inspections CRUD (App Router API routes with Prisma)
- Image uploads stored as base64 in the DB; baseline images can be added/removed
- Favourites: toggle star in lists; filter by favourites via checkbox
- Search/filters:
  - Transformers: by transformer number, pole number; region/type dropdowns
  - Inspections: similar search inputs
- Validation:
  - Adding/Editing Inspections: transformer must exist; minimum date is today
  - Adding Transformers: client-side check to ensure `transformerNumber` is unique
- Cascade delete: deleting a Transformer removes its Inspections

## Project structure (high level)

- `app/` — App Router pages
  - `app/api/*` — Legacy API (optional for Prisma mode)
- `components/` — UI components and modals
- `lib/api.ts` — centralized `NEXT_PUBLIC_BACKEND_URL` base and helper
- `lib/prisma.ts` — Prisma client singleton
- `prisma/` — Prisma schema, migrations, and the SQLite DB file
- `types/` — shared TypeScript types
- `backend/` — Spring Boot app (controllers, entities, repos, config)

## Project Description

- The project has 2 main pages: transformers and inspections.
- The transformers page allows users to create, read, update, and delete (CRUD) transformer records.
![Screenshot of transformer page](transformer_page.png)
- The inspections page allows users to view and manage inspection records.
![Screenshot of inspections page](inspection_page.png)
- Details pertaining to a particular transformer can be viewed in a user friendly interface.
![Screenshot of transformer detail](transformer_detail.png)
- An AI model can be used to analyze and generate insights from the thermal images of transformers.
![Screenshot of AI inference page](ai_inference.png)

## Troubleshooting

- prisma generate/migrate errors: try `pnpm run db:reset` (destructive), or delete `prisma/dev.db` and re-run `pnpm run db:setup`.
- If the dev server fails on first run, stop it, run `pnpm run db:setup` once, then `pnpm run dev`.
- Windows PowerShell: to start with a custom backend URL temporarily, run

  `$env:NEXT_PUBLIC_BACKEND_URL = "http://localhost:8080"; pnpm dev`

  Or put the value in `.env.local` to make it persistent.

## Notes

- Package manager: pnpm-first. Running `pnpm install` in the project root installs all dependencies. No extra global tools are required beyond pnpm and Node.
- Frontend reads `NEXT_PUBLIC_BACKEND_URL` (default `http://localhost:8080`).
