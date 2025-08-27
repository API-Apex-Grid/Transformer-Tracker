# Apex Grid

Next.js App Router frontend with a Spring Boot backend (preferred). Legacy Next.js API + Prisma/SQLite remains available for local only.

- Frontend: Next.js (App Router), React, Tailwind
- Backend: Spring Boot (Web, Data JPA, Security), H2 (in-memory/file) or your DB
- Images are saved as base64 strings in the database
- Inspections relate to Transformers and are cascade-deleted when a Transformer is removed

## Prerequisites

- Frontend
  - Node.js 18+ (20+ recommended)
  - pnpm (preferred). One-time install: `npm i -g pnpm`
- Backend (Spring Boot)
  - Java 21
  - Maven 3.9+

## Quick start (Spring backend + Next.js frontend)

1. Start the backend (port 8080)

```powershell
# from the project root
cd backend
mvn spring-boot:run
```

- API base: <http://localhost:8080>
- Database: file-based H2 located at `backend/db/transformerdb.mv.db`

1. Start the frontend (port 3000)

```powershell
# in a new terminal, from the project root
pnpm install

# point the UI to the Spring backend (optional if using the default)
# create .env.local with this line (no quotes):
# NEXT_PUBLIC_BACKEND_URL=http://localhost:8080

pnpm run dev
```

1. Open the app at <http://localhost:3000>

Notes

- All frontend API calls go to `${NEXT_PUBLIC_BACKEND_URL}/api/...` via `lib/api.ts`.
- If you change backend port/host, update `NEXT_PUBLIC_BACKEND_URL` in `.env.local` and restart `pnpm dev`.

## Environment variables

Since env files are ignored by Git, create them locally as needed.

- Frontend (.env.local at project root)

  Create a file named `.env.local` next to `package.json` with:

  ```env
  NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
  ```

  Windows PowerShell (temporary for the current shell only):

  ```powershell
  $env:NEXT_PUBLIC_BACKEND_URL = "http://localhost:8080"
  pnpm run dev
  ```

- Backend (Spring) optional overrides

  Defaults are in `backend/src/main/resources/application.yml`. You can override via environment variables (restart backend after changes):

  ```powershell
  # Change server port
  $env:SERVER_PORT = "8080"

  # Point to a different DB (example keeps the project default)
  $env:SPRING_DATASOURCE_URL = "jdbc:h2:file:./db/transformerdb;MODE=PostgreSQL"

  # Set a stronger JWT secret
  $env:APP_JWT_SECRET = "replace-with-a-long-random-secret"

  # Run the backend
  cd backend
  mvn spring-boot:run
  ```

  Notes:
  - Spring maps `app.jwt.secret` -> `APP_JWT_SECRET`, `server.port` -> `SERVER_PORT`, etc.
  - Ensure the backend can read the env vars (set them in the same shell where you start Maven, or use your system’s env settings).

## Data and persistence

- When using the Spring backend, data is stored in `backend/db/transformerdb.mv.db` (H2 file DB).
- Data survives backend restarts. Remove the file if you want a clean slate.
- The legacy Prisma SQLite DB (`prisma/dev.db`) is only used in the alternative mode below.

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

- Backend port in use (8080): stop the process using the port, or temporarily change `server.port` in `backend/src/main/resources/application.yml`.
- H2 console won’t connect: verify JDBC URL is `jdbc:h2:file:./db/transformerdb`, user `sa`, and empty password.
- DB file not created: ensure the backend is running and you’ve performed at least one API action (the file appears on first write).

## Notes

- Package manager: pnpm-first. Running `pnpm install` in the project root installs all dependencies. No extra global tools are required beyond pnpm and Node.
- Frontend reads `NEXT_PUBLIC_BACKEND_URL` (default `http://localhost:8080`).
