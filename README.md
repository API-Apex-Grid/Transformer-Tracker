# 🚀 Apex Grid

## 🌐 Live app

- Production (deployed): <https://apex-grid-transformer-tracker.vercel.app/>
- Want to run everything locally? Check the local branch

## 🔐 Auth

- Log in with `user1`..`user5` using the same value as the password (e.g., `user3`/`user3`).

## ✨ Features

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
- Persistance of AI annotated images
- Users also may edit annotations or add their own annotations
- Export of metadata and images as a ZIP file

## 🗂️ Project structure (high level)

- `frontend/` — Next.js frontend
  - `app/` — App Router pages
  - `components/` — UI components and modals
  - `lib/api.ts` — centralized `NEXT_PUBLIC_BACKEND_URL` base and helper
  - `lib/prisma.ts` — Prisma client singleton
  - `prisma/` — Prisma schema, migrations, and the SQLite DB file
  - `types/` — shared TypeScript types
- `backend/` — Spring Boot app (controllers, entities, repos, config)
  - `src/main/java/com/apexgrid/transformertracker/` — Java source code
  - `src/main/resources/` — application config, including `application.yml`
  - `AI/` — AI model and related files

## 📝 Project Description

- The project has 2 main pages: transformers and inspections.
- The transformers page allows users to create, read, update, and delete (CRUD) transformer records.
  ![Screenshot of transformer page](transformers_page.png)
- The inspections page allows users to view and manage inspection records.
  ![Screenshot of inspections page](inspections_page.png)
- Details pertaining to a particular transformer can be viewed in a user friendly interface.
  ![Screenshot of inspection details page](inspection_details.png)
- Details pertaining to a particular inspection can be viewed in a user friendly interface.
  ![Screenshot of transformer detail](transformer_details.png)
- An AI model can be used to analyze and generate insights from the thermal images of transformers.
  ![Screenshot of AI inference page](ai_inference.png)

## 🛠️ For Improvements

- Feel free to open issues or submit PRs for any bugs, improvements, or new features.
- For your own use, you are free to customize the project as needed.
- If you find the project useful, consider starring the repo!
