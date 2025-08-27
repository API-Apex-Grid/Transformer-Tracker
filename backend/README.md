# Transformer Tracker Backend (Spring Boot)

Quickstart Spring Boot API to back the Next.js UI. Uses H2 in-memory DB by default.

## Prerequisites
- JDK 21+
- Maven 3.9+

## Run
- From `backend/`:
```powershell
mvn spring-boot:run
```
API served at http://localhost:8080

## Endpoints (parity with current UI)
- POST /api/login
- GET /api/transformers?tf=...&fav=true
- POST /api/transformers
- PUT /api/transformers/{id}
- DELETE /api/transformers/{id}
- POST /api/transformers/{id}/baseline (multipart: file, weather)
- GET /api/inspections?fav=true
- POST /api/inspections
- PUT /api/inspections/{id}
- DELETE /api/inspections/{id}
- POST /api/inspections/{id}/upload (multipart: file, weather)

## Notes
- CORS allows http://localhost:3000 by default.
- Passwords stored with BCrypt. /api/login auto-creates user1..5 on first login (dev behavior).
- Images stored as base64 in DB; baseline/maintenance timestamps are recorded.
- Switch H2 to Postgres later by updating `application.yml` and adding driver.
