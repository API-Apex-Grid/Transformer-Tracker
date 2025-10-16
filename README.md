# Apex Grid

## Technology Stack

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

create table public.inspections (
  id text not null,
  transformer_id text not null,
  inspectionnumber text not null,
  inspecteddate text null,
  maintainancedate text null,
  branch text null,
  status text null,
  imageurl text null,
  weather text null,
  lastanalysisweather text null,
  uploadedby text null,
  imageuploadedby text null,
  imageuploadedat timestamp with time zone null,
  favourite boolean not null default false,
  boundingboxes text null,
  faulttypes text null,
  faulttypehistory text null,
  boundingboxhistory text null,
  annotatedby text null,
  annotatedbyhistory text null,
  severity text null,
  timestamphistory text null,
  timestamp timestamp with time zone null,
  severityhistory text null,
  constraint inspections_pkey primary key (id),
  constraint inspections_inspectionnumber_key unique (inspectionnumber),
  constraint fk_inspections_transformer foreign KEY (transformer_id) references transformers (id) on delete CASCADE
)

create index IF not exists idx_inspections_transformer_id on public.inspections using btree (transformer_id) TABLESPACE pg_default;

create table public.transformers (
  id text not null,
  region text null,
  transformernumber text not null,
  polenumber text null,
  type text null,
  location text null,
  sunnyimage text null,
  cloudyimage text null,
  windyimage text null,
  uploadedby text null,
  sunnyimageuploadedby text null,
  cloudyimageuploadedby text null,
  windyimageuploadedby text null,
  sunnyimageuploadedat timestamp with time zone null,
  cloudyimageuploadedat timestamp with time zone null,
  windyimageuploadedat timestamp with time zone null,
  favourite boolean not null default false,
  constraint transformers_pkey primary key (id),
  constraint transformers_transformernumber_key unique (transformernumber)
)

CREATE TABLE public.users (
  id CHARACTER VARYING NOT NULL,
  username CHARACTER VARYING NOT NULL UNIQUE,
  passwordhash TEXT NOT NULL,
  createdat TIMESTAMP WITH TIME ZONE NOT NULL,
  image TEXT,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ai_model_parameters (
  param_key text not null,
  param_value double precision not null,
  updated_at timestamp with time zone not null default now(),
  constraint ai_model_parameters_pkey primary key (param_key)
) TABLESPACE pg_default;

CREATE TABLE public.ai_tuning_feedback (
  id uuid not null default gen_random_uuid (),
  inspection_id text not null,
  ai_box_count integer not null,
  user_box_count integer not null,
  box_diff integer not null,
  created_at timestamp with time zone not null default now(),
  previous_snapshot text null,
  final_snapshot text null,
  previous_faults text null,
  final_faults text null,
  previous_annotated text null,
  final_annotated text null,
  notes text null,
  constraint ai_tuning_feedback_pkey primary key (id)
) TABLESPACE pg_default;

```

### Recommended method: Use Docker for the backend

1. Create a `.env` file in the `backend/` directory based on `.env.example` with your DB credentials.

2. Build and run the Docker container

```powershell
# from the project root
cd backend
docker pull warrensjk/transformer-tracker-local:latest
docker run -d --env-file .env -p 8080:8080 --name transformer-tracker warrensjk/transformer-tracker-local:latest
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
pnpm install
pnpm run dev
```

2. Open the app at <http://localhost:3000>

## Auth

- Log in with `user1`..`user5` using the same value as the password (e.g., `user3`/`user3`).

## Troubleshooting

- If you encounter CORS issues, ensure that the `allowed-origins` in `application.yml` includes your frontend URL.
- Ensure that the AI model dependencies are installed correctly in the backend/AI directory.
- Ensure that no other application is using ports 3000 (frontend) or 8080 (backend).
