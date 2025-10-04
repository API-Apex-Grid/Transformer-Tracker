# Apex Grid

## Live app

- Production (deployed): <https://apex-grid-transformer-tracker.vercel.app/>
- Want to run everything locally? Use the below instructions

Next.js App Router frontend with a Spring Boot backend (preferred). Legacy Next.js API + Prisma/SQLite remains available for local only.

- Frontend: Next.js (App Router), React, Tailwind
- Backend: Spring Boot (Web, Data JPA, Security), postgres

## Prerequisites

- Frontend
  - Node.js 18+ (20+ recommended)
  - pnpm (preferred). One-time install: `npm i -g pnpm`
- Backend (Spring Boot)
  - Java 21
  - Maven 3.9+

## Run locally (Spring backend + Next.js frontend)

Make sure the database is running and accessible. Schema is given below

```sql

CREATE TABLE public.inspections (
  id CHARACTER VARYING NOT NULL,
  transformer_id CHARACTER VARYING NOT NULL,
  inspectionnumber TEXT NOT NULL UNIQUE,
  inspecteddate TEXT,
  maintainancedate TEXT,
  branch CHARACTER VARYING,
  status CHARACTER VARYING,
  imageurl TEXT,
  weather CHARACTER VARYING,
  lastanalysisweather TEXT,
  uploadedby TEXT,
  imageuploadedby TEXT,
  imageuploadedat TIMESTAMP WITH TIME ZONE,
  favourite BOOLEAN NOT NULL DEFAULT FALSE,
  boundingboxes TEXT,
  faulttypes TEXT,
  CONSTRAINT inspections_pkey PRIMARY KEY (id),
  CONSTRAINT fk_inspections_transformer FOREIGN KEY (transformer_id) REFERENCES public.transformers(id)
);

CREATE TABLE public.transformers (
  id CHARACTER VARYING NOT NULL,
  region CHARACTER VARYING,
  transformernumber TEXT NOT NULL UNIQUE,
  polenumber TEXT,
  type CHARACTER VARYING,
  location CHARACTER VARYING,
  sunnyimage TEXT,
  cloudyimage TEXT,
  windyimage TEXT,
  uploadedby TEXT,
  sunnyimageuploadedby TEXT,
  cloudyimageuploadedby TEXT,
  windyimageuploadedby TEXT,
  sunnyimageuploadedat TIMESTAMP WITH TIME ZONE,
  cloudyimageuploadedat TIMESTAMP WITH TIME ZONE,
  windyimageuploadedat TIMESTAMP WITH TIME ZONE,
  favourite BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT transformers_pkey PRIMARY KEY (id)
);

CREATE TABLE public.users (
  id CHARACTER VARYING NOT NULL,
  username CHARACTER VARYING NOT NULL UNIQUE,
  passwordhash TEXT NOT NULL,
  createdat TIMESTAMP WITH TIME ZONE NOT NULL,
  image TEXT,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

```

### Recommended method: Use Docker for the backend

1. Create a `.env` file in the `backend/` directory based on `.env.example` with your DB credentials.

2. Build and run the Docker container

```powershell
# from the project root
cd backend
docker pull warrensjk/transformer-tracker:latest
docker run -d --env-file .env -p 8080:8080 --name transformer-tracker warrensjk/transformer-tracker:latest
```

### Alternative method: Run the backend directly with Maven

1. Install python dependencies for the AI model

```powershell
# from the project root
cd backend/AI
pip install -r requirements.txt
```

2. Start the backend (port 8080)

```powershell
# from the project root
cd backend
mvn clean install

$env:DB_URL="<your-database-url>"
$env:DB_USERNAME="<your-database-username>"
$env:DB_PASSWORD="<your-database-password>"

mvn spring-boot:run

```

- API base: <http://localhost:8080>

### Start the frontend

1. Start the frontend (port 3000)

```powershell
# from the project root (new terminal)
cd frontend
$env:DB_URL="<backend-url>" # optional:localhost:8080 is default
pnpm install
pnpm run dev
```

2. Open the app at <http://localhost:3000>

## Auth

- Log in with `user1`..`user5` using the same value as the password (e.g., `user3`/`user3`).

## Features

- Transformers and Inspections CRUD
- Image uploads stored as base64 in the DB; baseline images can be added/removed
- Favourites: toggle star in lists; filter by favourites via checkbox
- Search/filters:
  - Transformers: by transformer number, pole number; region/type dropdowns
  - Inspections: similar search inputs
- Validation:
  - Adding/Editing Inspections: transformer must exist; minimum date is today
  - Adding Transformers: client-side check to ensure `transformerNumber` is unique
- Cascade delete: deleting a Transformer removes its Inspections
- AI model can be used to analyze thermal images of transformers (see `backend/AI/README.md` for details)

## Project structure (high level)

- `frontend/` — Next.js frontend
  - `app/` — App Router pages
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

- Windows PowerShell: to start with a custom backend URL temporarily, run

  `$env:NEXT_PUBLIC_BACKEND_URL = "http://localhost:8080"; pnpm dev`

  Or put the value in `.env.local` to make it persistent.

- Backend port in use (8080): stop the process using the port, or temporarily change `server.port` in `backend/src/main/resources/application.yml`.
- H2 console won’t connect: verify JDBC URL is `jdbc:h2:file:./db/transformerdb`, user `sa`, and empty password.
- DB file not created: ensure the backend is running and you’ve performed at least one API action (the file appears on first write).

## Notes

- Package manager: pnpm-first. Running `pnpm install` in the project root installs all dependencies. No extra global tools are required beyond pnpm and Node.
- Frontend reads `NEXT_PUBLIC_BACKEND_URL` (default `http://localhost:8080`).
