# Transformer Tracker – Working Notes

## Frontend ↔ Backend Connectivity

- Next.js 13 app-directory frontend (`frontend/`) sits behind Vercel-style API routes that proxy to the Spring Boot backend. Every handler under `app/api/**` forwards the request to `NEXT_PUBLIC_BACKEND_URL`/`BACKEND_URL` (default `http://localhost:8080`) while preserving auth headers and, where needed, the custom `x-username` header.
- `dynamic = "force-dynamic"` and `revalidate = 0` on the Next.js routes disable ISR caching so inspector/transformer lists always reflect latest backend state.
- Client-side context providers (`context/InspectionsContext.tsx`, `context/TransformersContext.tsx`) hydrate lists by calling the proxy routes (`/api/inspections`, `/api/transformers`) and cache them in React state. They expose helpers that in turn call the backend via `apiUrl()` for mutations.
- `ThermalImage.tsx` streams `multipart/form-data` directly to the backend analysis endpoint using `fetch(apiUrl(.../analyze))` so that large files never traverse the Next.js edge runtime.
- Uploaded baseline and inspection imagery is kept as base64 data URLs inside Postgres columns (`text` type) and surfaced to the UI as-is for preview overlays.
- CORS is centralized in `CorsConfig` with origins read from `cors.allowed-origins` (default `http://localhost:3000` and the production Vercel domain).

## HTTP API Surface

### Authentication & Profile

| Method | Path | Description | Notes |
| --- | --- | --- | --- |
| POST | /api/login | Username/password check against `users` table. | Uses BCrypt hashes; returns `{ token: "<jwt>", username, image }`. The token is a signed JWT; the frontend should store it (e.g. localStorage) and send it as `Authorization: Bearer <jwt>` on subsequent requests. The login endpoint remains public; other endpoints enforce JWT-based auth via `SecurityConfig`. |
| GET | /api/profile | Fetch minimal profile for the authenticated user. | Auth required: `Authorization: Bearer <jwt>`. The server reads the username from the JWT subject and ignores any `username` query param. Response `{ username, image }`. |
| POST | /api/profile/image | Update stored base64 avatar. | Auth required. Request body `{ image }` (username is inferred from JWT); blank image clears it. |
| POST | /api/profile/password | Change password after verifying `currentPassword`. | Auth required. Server uses username from JWT; body must include `currentPassword` and `newPassword`. |

### Transformers

| Method | Path | Description | Notes |
| --- | --- | --- | --- |
| GET | /api/transformers | List transformers. | Query `tf` (exact transformerNumber) and `fav=true` filter; summary proxy drops image blobs for faster list rendering|
| GET | /api/transformers/{id} | Fetch a single transformer. | Returns full entity including base64 baseline images.|
| POST | /api/transformers | Create transformer metadata and optional baselines. | Auth required for mutations: `Authorization: Bearer <jwt>`. Request body mirrors `Transformer` fields; the server records `createdBy` from the JWT subject. |
| PUT | /api/transformers/{id} | Update transformer. | Auth required. Replaces entity by ID; caller should preserve existing IDs when overwriting; `modifiedBy` is set from JWT. |
| DELETE | /api/transformers/{id} | Remove transformer and cascade inspections. | Auth required. Responds `{ ok: true }` on success; action is attributed to the JWT user. |
| POST | /api/transformers/{id}/baseline | Upload baseline thermal image. | Auth required. `multipart/form-data` with parts `file` (image) and `weather` (`sunny\|cloudy\|rainy`). The uploader is taken from the JWT; the `x-username` header is deprecated and ignored by the server. |

### Inspections & Analysis

| Method | Path | Description | Notes |
| --- | --- | --- | --- |
| GET | /api/inspections | List inspections. | Optional `fav=true`; frontend uses `summary=1` query on proxy to strip heavy fields.|
| GET | /api/inspections/{id} | Fetch full inspection. | Includes transformer reference and latest analysis blobs.|
| GET | /api/inspections/{id}/export | Generate analysis export ZIP. | Packages `metadata.json`, `history.csv`, candidate/baseline images, and plotting script.|
| POST | /api/inspections | Create inspection linked to transformer. | Auth required. Body must include `transformer` with `id` or `transformerNumber`. The created record is attributed to the JWT user. |
| PUT | /api/inspections/{id} | Update inspection metadata. | Auth required. Validates transformer reference same as create; action attributed to JWT user. |
| DELETE | /api/inspections/{id} | Delete inspection. | Auth required. Returns `{ ok: true }` and records the deleter from JWT. |
| POST | /api/inspections/{id}/upload | Store latest inspection image. | Auth required. `multipart/form-data` (`file`, `weather`); uploader is taken from JWT; `x-username` header is deprecated and ignored. |
| POST | /api/inspections/{id}/analyze | Run AI comparison using uploaded candidate file. | Auth required. `multipart/form-data` with `file` and `weather`; archives previous AI results before persisting new bounding boxes and per-box metadata. Analysis runs use parameters cached/persisted server-side. |
| POST | /api/inspections/{id}/clear-analysis | Remove stored analysis artifacts. | Auth required. Clears image, boxes, fault metadata, history snapshots. |
| POST | /api/inspections/{id}/boxes | Append a user-drawn bounding box. | Auth required. JSON body `{ x,y,w,h,faultType,comment }`; author is taken from JWT (the `x-username` header is ignored). Response echoes arrays plus updated `recentStatus`. |
| DELETE | /api/inspections/{id}/boxes/{index} | Delete a box by array index. | Auth required. Archives prior state, realigns aligned arrays, responds with updated payload. |
| DELETE | /api/inspections/{id}/boxes | Delete a box by coordinates. | Auth required. Query params `x,y,w,h`; tolerant to ±0.5 pixel for float rounding. |
| PUT | /api/inspections/{id}/boxes/bulk | Replace boxes/faults/comments en masse. | Auth required. Body arrays `boundingBoxes`, `faultTypes`, `annotatedBy`, `comments`, optional `tuneModel` (default `true`); archives previous snapshot and optionally triggers tuning. `annotatedBy` values will be validated/normalized against the JWT user when present. |
| POST | /api/inspections/model/reset | Reset AI tunable parameters. | Auth required. Typically restricted to admin users (checked via roles/claims in the JWT). Restores defaults via `AiParameterService` and returns `{ ok, parameters, resetBy }`. |

### Model Parameter Storage

| Method | Path | Description | Notes |
| --- | --- | --- | --- |
| GET | *(not exposed)* | Parameters are read server-side only. | `AiParameterService` caches values and supplies them to the analyzer/tuner.|

## Spring Boot architecture (backend)

- Layered structure: the backend follows a conventional Spring Boot layering pattern to keep concerns separated:
  - Controller: HTTP entrypoints that validate requests, map inputs to domain types, and return HTTP responses (`@RestController`). Controllers should remain thin — orchestrating service calls and shaping the ResponseEntity. Example: `InspectionController` handles upload, analyze, export and box mutation endpoints.
  - Service: Application/business logic and orchestration (`@Service`). Services perform image/file IO, call downstream tools (the Python analyzer), transform domain data, and coordinate transactions. Example: `PythonAnalyzerService` wraps the external Python process; `ParameterTuningService` and `AiParameterService` encapsulate tuning and parameter persistence logic.
  - Repository: Persistence layer (`@Repository` or Spring Data `JpaRepository` interfaces). These are simple, CRUD-focused interfaces. Example: `InspectionRepo`, `TransformerRepo` live under `...repo` and map entities to database rows.
  - Model/Entity: Domain objects (`@Entity`, DTOs) that represent the database schema and API payloads. Look in `backend/src/main/java/com/apexgrid/transformertracker/model/` for inspection/transformer classes and their JSON fields.
  - Configuration/Resources: `application.properties` / `application.yml` and resource files (export helpers under `src/main/resources/export`) centralize runtime settings and assets.

- Wiring and DI: The app uses constructor injection (preferred) to provide dependencies. Beans are discovered via `@Service`, `@Repository`, `@Component`, and controllers via `@RestController`. This makes unit testing straightforward (mock services/repos and call controllers directly).

- Property binding and environment wiring:
  - Simple properties are injected with `@Value("${...}")` (see `PythonAnalyzerService` where `app.ai.python` and `app.ai.script` are injected). These properties may be set in `application.yml`, `application.properties`, or via environment variables using Spring Boot relaxed binding (e.g. `APP_AI_PYTHON`, `APP_AI_SCRIPT`). The Dockerfile demonstrates producing environment variables mapped to Spring properties.

- Error handling & responses: Controllers use `ResponseEntity` to control HTTP status and payloads. Services throw exceptions for unexpected states; controllers catch or translate them into friendly client responses (see `InspectionController.analyze` for strategic try/catch and mapping to 400/500 responses).

- Where code lives in this repo (quick map):
  - Controllers: `backend/src/main/java/com/apexgrid/transformertracker/web/` (e.g. `InspectionController.java`).
  - Services: `backend/src/main/java/com/apexgrid/transformertracker/ai/` (e.g. `PythonAnalyzerService.java`, `ParameterTuningService.java`, `AiParameterService.java`).
  - Repositories: `backend/src/main/java/com/apexgrid/transformertracker/repo/` (`InspectionRepo`, `TransformerRepo`).
  - Models/Entities: `backend/src/main/java/com/apexgrid/transformertracker/model/`.
  - Resources: `backend/src/main/resources/` (properties, export helpers).

- Best practices used / recommendations:
  - Keep controllers thin: validate inputs, call services, return DTOs or ResponseEntity.
  - Business rules belong in services so they are testable without HTTP plumbing.
  - Repositories expose only persistence operations; complex queries can be placed in repository implementations or service-level methods that combine repo calls.
  - External process calls (like the Python analyzer) are wrapped in a service (`PythonAnalyzerService`) so the rest of the app doesn't rely on ProcessBuilder details; this wrapper also centralizes retries, timeouts, and parameter handling if you add them later.

## AI Analysis Pipeline (`backend/AI/analyze.py`)

- Inputs: baseline image (PNG) and candidate inspection image (PNG). Optional JSON config supplies parameter overrides; defaults pulled from `DEFAULT_PARAMS`.
- Parameters may arrive via the generated `params.json` file or `TT_PARAMS` environment variable. Values align with `AiParameterKey` enums.
- Outputs: JSON payload containing bounding boxes, per-box metadata, and overall severity metrics that the backend stores alongside inspection records.
- Dependencies: Pillow, NumPy, optional OpenCV (SIFT); listed in `backend/AI/requirements.txt`.
- Spring wrapper (`PythonAnalyzerService`) writes temp PNGs plus a params JSON, invokes `app.ai.python` (default `py`), and cleans temp artifacts after reading stdout JSON.

### Processing Flow

- Convert both images to RGB, optionally crop, and (when re-enabled) align baseline to candidate via SIFT homography (OpenCV). Alignment is currently disabled by default but code is present.
- Sample HSV histograms (`h_bins`×`s_bins`) at interval `sample_every`, compute L2 histogram distance, and collect V-channel deltas (`dv95` percentile) as severity drivers.
- Build a warm-pixel mask when hue falls within thresholds, saturation/value exceed minimums, and the candidate is brighter than baseline by `contrast_threshold`.
- Flood-fill connected components inside the mask, discarding blobs below `min_area_pixels` or `min_area_ratio`. Nested boxes with ≥50% overlapping area are removed.
- Classify overall fault (`loose joint`, `wire overload`, `point overload`, or `none`) using area ratios, aspect ratio, and central overlap heuristics.
- For every remaining box, compute average/max V deltas, map to a severity score (`severity_lower_delta`/`severity_upper_delta`), and attach per-box metadata (`boxFault`, `severity`, `severityLabel`, `avgDeltaV`, `maxDeltaV`).
- Emit JSON summary `{ prob, histDistance, dv95, warmFraction, imageWidth, imageHeight, boxes, boxInfo, faultType, overallSeverity, overallSeverityLabel }`.

### Fault Detection Summary

- Detects candidate “hot” pixels by comparing HSV deltas between baseline and inspection frames.
- Groups those pixels into bounding boxes and drops noise by enforcing minimum size and overlap rules.
- Assigns each box a fault type and severity based on heat concentration, area ratios, and brightness deltas relative to the baseline.
- Produces an overall fault classification that reflects the most critical detected hotspot.

## AI Tuning Feedback Loop (`ParameterTuningService`)

- Triggered by `PUT /api/inspections/{id}/boxes/bulk` (unless the caller sets `tuneModel=false`).
- Archives the previous AI snapshot via `archivePreviousAnalysis`, then records a `ParameterFeedback` row capturing AI/user box counts, diffs, serialized snapshots, and notes.
- Writes the candidate image to disk, computes added/removed box sets (tolerant to ±0.5 px), and builds a payload with previous/final boxes, faults, annotators, comments, box tolerance, and the current parameter snapshot.
- Invokes `backend/AI/tune_parameters.py`. The tuner runs a deterministic, heuristic adjustment routine based on per-box HSV statistics and the current parameter snapshot. Key points:
  - Input: the candidate PNG plus a JSON payload containing `parameters` (current values), `addedBoxes` and `removedBoxes` (arrays of `[x,y,w,h]`). The script computes a global `mean_value` from the candidate image's V channel and then measures each box.
  - Per-box measurements (from `measure_box`) returned for each box include: `pixel_count`, `area_ratio` (box area / image area), `mean_saturation`, `mean_value`, `mean_delta_value` (V − global mean), `warm_fraction` (fraction of pixels whose hue is inside the warm window), `mean_hue` (circular mean in [0,1]) and `max_value`.
  - Tuning constants (implemented in the script):
    - SATURATION_MARGIN = 0.01, VALUE_MARGIN = 0.01, CONTRAST_MARGIN = 0.01
    - HUE_STEP = 0.01, AREA_RATIO_STEP = 0.0005
  - Adjustment strategy (high-level):
    - For `added` boxes (human labeled hotspots that the AI missed) the tuner assumes thresholds are too strict. It decreases thresholds to make detection more permissive:
      - If `warm_sat_threshold - mean_saturation > SATURATION_MARGIN` then `warm_sat_threshold` is decreased by delta = -min(0.05, max(0.005, sat_diff * 0.5)).
      - Equivalent logic applies to `warm_val_threshold` and `contrast_threshold` using `mean_value` and `mean_delta_value`.
      - If `min_area_pixels` is larger than the observed `pixel_count`, it is reduced with a bounded step (delta = -min(50.0, max(5.0, pixel_diff * 0.25))).
      - If the observed area ratios are smaller than `min_area_ratio`, the script reduces `min_area_ratio` by a small step.
      - If the box's `warm_fraction >= 0.5`, tune the hue window by nudging `warm_hue_low` up or `warm_hue_high` down toward the measured `mean_hue` (bounded by `HUE_STEP`).
    - For `removed` boxes (AI boxes the user removed) the tuner assumes thresholds are too permissive. It increases thresholds to tighten detection:
      - If `mean_saturation - warm_sat_threshold < -SATURATION_MARGIN` then `warm_sat_threshold` is increased by a bounded delta (making it harder to count a pixel as warm).
      - Similar symmetric adjustments are applied for `warm_val_threshold`, `contrast_threshold`, `min_area_pixels` and `min_area_ratio` (using slightly different step factors and bounds).
      - Hue adjustments mirror the added-case logic but move the hue bounds away from the problematic `mean_hue`.
  - Update bookkeeping: updates are accumulated per-parameter (the `apply` helper) and tiny deltas (< 1e-6) are filtered out before returning.
  - Output: the script prints a JSON object containing `parameter_updates` (map of parameter → delta), `notes` (a short summary string), and counts (`addedCount`, `removedCount`).
- The backend receives these suggested deltas, then `AiParameterService.adjustValue` clamps each new value to configured min/max, persists the update to `ai_model_parameters` (Postgres), and refreshes the in-memory cache so subsequent analyses immediately use the new parameters.

### Tuning Workflow

- Captures human-labelled adjustments and contrasts them with prior AI output to diagnose where the model over- or under-detected hotspots.
- Translates those discrepancies into concrete threshold shifts (e.g., hue window, contrast delta, minimum area) via `tune_parameters.py`.
- Persists the adjusted parameters so the very next analysis run benefits from the feedback without redeploying the service.

## Performance-Oriented Behaviors

- `AiParameterService` memoizes parameter values in a concurrent map to avoid repeated database hits while still persisting mutations.
- Frontend “summary” proxy routes strip heavyweight fields (base64 images, history arrays) to reduce payload size for list views; detailed fetches hit full endpoints only when needed.
- Inspection history columns (`boundingBoxes`, `faultTypes`, etc.) are stored as compact JSON strings inside `text` columns, which keeps schema simple and avoids Postgres LOB stream penalties noted in the code comments.
- File uploads stream through the proxy without buffering (`req.body` piping) to keep memory usage low for large images.
- Hikari connection pool is tuned for low-concurrency workloads (max 5, idle trimming) in `application.properties`; Open-In-View is disabled to reduce transactional overhead.

## Operational Notes & Gotchas

- Environment: configure Postgres credentials via `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `APP_JWT_SECRET`. Python interpreter path can be overridden (`app.ai.python`), defaulting to `py` per `application.yml`.
- Image baseline selection: analysis chooses the transformer’s baseline matching requested `weather`; if none exists it falls back to any available baseline and errors if all are missing.
- History management: every AI run or user edit archives the previous arrays (`boundingBoxHistory`, `faultTypeHistory`, `severity/comments`, `status`) along with timestamps, enabling export replay.
- Exports bundle helper scripts from `src/main/resources/export/*` so analysts can reproduce bounding box plots offline.
- Frontend login flow stores `isLoggedIn` and `username` in `localStorage`; contexts listen for a custom `app:logged-in` event to trigger reloads.
- Python requirements must be installed before running analysis/tuning (`pip install -r backend/AI/requirements.txt`).
