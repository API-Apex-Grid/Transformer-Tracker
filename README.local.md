# Local Development (No Docker)

This guide is for running everything locally without Docker, using a persistent H2 file database managed by Spring.

## Prerequisites

- Java 21 (for Spring Boot 3.3.x)
- Node.js 18+ and pnpm

## 1) Database

No manual DB setup needed. The backend uses an H2 file database at `backend/db/transformerdb.mv.db`.

## 2) Start the backend

```powershell
cd backend
mvn spring-boot:run
```

Backend runs at <http://localhost:8080> and stores data in `backend/db/transformerdb.mv.db`.

## 3) Start the frontend

```powershell
cd frontend
pnpm install
pnpm dev
```

Frontend runs at <http://localhost:3000>

## Login

- username: user1 .. user5
- password: same as username (e.g., user1/user1)

## Notes

- Backend DB is a persistent H2 file at `backend/db/transformerdb.mv.db`.
- If you need a clean slate, stop the backend and delete that file; it will be recreated on next start.
