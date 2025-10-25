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
| POST | /api/login | Username/password check against `users` table. | Uses BCrypt hashes; returns `{ token: "dev-token", username, image }`. No JWT enforcement yet (`SecurityConfig` permits all requests).|
| GET | /api/profile | Fetch minimal profile for a username. | Query param `username`; response `{ username, image }`.|
| POST | /api/profile/image | Update stored base64 avatar. | Body `{ username, image }`; blank image clears it.|
| POST | /api/profile/password | Change password after verifying `currentPassword`. | Requires `username`, `currentPassword`, `newPassword`.|

### Transformers

| Method | Path | Description | Notes |
| --- | --- | --- | --- |
| GET | /api/transformers | List transformers. | Query `tf` (exact transformerNumber) and `fav=true` filter; summary proxy drops image blobs for faster list rendering|
| GET | /api/transformers/{id} | Fetch a single transformer. | Returns full entity including base64 baseline images.|
| POST | /api/transformers | Create transformer metadata and optional baselines. | Request body mirrors `Transformer` fields; frontend stamps uploader metadata when sending|
| PUT | /api/transformers/{id} | Update transformer. | Replaces entity by ID; caller should preserve existing IDs when overwriting.|
| DELETE | /api/transformers/{id} | Remove transformer and cascade inspections. | Responds `{ ok: true }` on success.|
| POST | /api/transformers/{id}/baseline | Upload baseline thermal image. | `multipart/form-data` with parts `file` (image) and `weather` (`sunny\|cloudy\|rainy`). Optional `x-username` header annotates uploader.|

### Inspections & Analysis

| Method | Path | Description | Notes |
| --- | --- | --- | --- |
| GET | /api/inspections | List inspections. | Optional `fav=true`; frontend uses `summary=1` query on proxy to strip heavy fields.|
| GET | /api/inspections/{id} | Fetch full inspection. | Includes transformer reference and latest analysis blobs.|
| GET | /api/inspections/{id}/export | Generate analysis export ZIP. | Packages `metadata.json`, `history.csv`, candidate/baseline images, and plotting script.|
| POST | /api/inspections | Create inspection linked to transformer. | Body must include `transformer` with `id` or `transformerNumber`.|
| PUT | /api/inspections/{id} | Update inspection metadata. | Validates transformer reference same as create.|
| DELETE | /api/inspections/{id} | Delete inspection. | Returns `{ ok: true }`.|
| POST | /api/inspections/{id}/upload | Store latest inspection image. | `multipart/form-data` (`file`, `weather`); optional `x-username` recorded.|
| POST | /api/inspections/{id}/analyze | Run AI comparison using uploaded candidate file. | `multipart/form-data` with `file` and `weather`; archives previous AI results before persisting new bounding boxes and per-box metadata.|
| POST | /api/inspections/{id}/clear-analysis | Remove stored analysis artifacts. | Clears image, boxes, fault metadata, history snapshots.|
| POST | /api/inspections/{id}/boxes | Append a user-drawn bounding box. | JSON body `{ x,y,w,h,faultType,comment }`; optional `x-username` marks author; response echoes arrays plus updated `recentStatus`.|
| DELETE | /api/inspections/{id}/boxes/{index} | Delete a box by array index. | Archives prior state, realigns aligned arrays, responds with updated payload.|
| DELETE | /api/inspections/{id}/boxes | Delete a box by coordinates. | Query params `x,y,w,h`; tolerant to ±0.5 pixel for float rounding.|
| PUT | /api/inspections/{id}/boxes/bulk | Replace boxes/faults/comments en masse. | Body arrays `boundingBoxes`, `faultTypes`, `annotatedBy`, `comments`, optional `tuneModel` (default `true`); archives previous snapshot and optionally triggers tuning.|
| POST | /api/inspections/model/reset | Reset AI tunable parameters. | Restores defaults via `AiParameterService` and returns `{ ok, parameters, resetBy }`.|

### Model Parameter Storage

| Method | Path | Description | Notes |
| --- | --- | --- | --- |
| GET | *(not exposed)* | Parameters are read server-side only. | `AiParameterService` caches values and supplies them to the analyzer/tuner.|

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
- Invokes `backend/AI/tune_parameters.py`, which measures HSV statistics for each added/removed box and suggests parameter deltas (e.g., relax warm thresholds for missed hotspots, tighten thresholds for false positives). Small deltas (<1e-6) are filtered out.
- Applies suggested deltas through `AiParameterService.adjustValue`, which clamps to configured min/max and persists to `ai_model_parameters` (Postgres). Updated values are immediately cached and will be used by subsequent analyses.

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
