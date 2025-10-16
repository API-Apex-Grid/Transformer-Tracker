# Transformer Thermal Analysis (AI)

This document explains, end-to-end, how the `analyze.py` script classifies transformer faults, how annotations are produced and consumed, how the backend persists results, and the current limitations.

The script compares a baseline image against a candidate image of the same transformer and outputs a compact JSON structure consumed by the backend/frontend.

## Step‑by‑step classification flow

1. Input and pre‑crop

   - Inputs: `baseline.png`, `candidate.png`.
   - Both images are converted to RGB and then a center crop removes 5% from the left and right sides. This reduces border content and alignment noise.

2. Baseline → Candidate alignment (SIFT + Homography)

   - Convert both images to grayscale and detect SIFT keypoints/descriptors.
   - Match descriptors with a KNN matcher and filter using Lowe’s ratio test (0.75).
   - Estimate a homography with RANSAC and warp the baseline into the candidate’s frame.
   - Build a binary `valid_mask` by warping a full‑ones mask through the same homography. Only pixels inside this mask are considered “valid” during comparison (prevents penalizing unmapped/black borders).
   - Fallback: if SIFT cannot be created or not enough matches are found, the script skips warping and uses the original baseline, with `valid_mask=None`.

3. Pixel‑wise metrics in HSV

   - For each valid pixel (or all pixels if no mask):
     - Convert baseline and candidate pixels to HSV.
     - Accumulate 2D histograms over H (30 bins) and S (32 bins) for baseline and candidate separately.
     - Sample every 10th pixel to collect dV = max(0, V_candidate − V_baseline) and later compute dv95 (95th percentile of dV), a strong‑tail measure of brightening.
     - Mark a pixel as “warm” if all hold: warm hue (H ≤ 0.17 or H ≥ 0.95), saturation ≥ 0.3, value ≥ 0.4, and contrast (V_candidate − V_baseline ≥ 0.15).

4. Region detection (connected components)

   - Perform 4‑connected flood fill over the warm mask to create bounding boxes for regions with area ≥ max(32 px, 0.1% of valid pixels).
   - Record `[x, y, w, h]` for each region.

5. Fault type classification (two passes)

   - First pass on raw boxes determines the overall `faultType` (preserved even after filtering):
     - Define a central band as the middle third of width and height.
     - For each box compute area fraction, aspect ratio, and overlap with the center band.
     - Decision order:
       1. If any box covers ≥30%  → `loose joint`.
       1. Else if the largest box area fraction < 30% → `point overload`.
       1. Else if any box has aspect ratio ≥ 2.0 → `wire overload`.
       1. Else → `none`.
   - Nested box filtering: remove a box if ≥50% of its area overlaps another larger box.
   - Second pass on filtered boxes yields per‑box labels and metrics (see Annotations below).

6. Global similarity & probability

   - Normalize the H/S histograms and compute L2 distance (`histDistance`).
   - Compute `dv95` (95th percentile of sampled dV values) and `warmFraction` (warm pixel count / valid pixel count).
   - Combine into a heuristic score: `(histDistance/0.5) + dv95 + (warmFraction*2.0)` and convert via logistic to `prob` in [0,1].

7. Severity mapping

   - A helper maps delta brightness to severity in [0,1] using a soft threshold: 0.15 (start) to 0.50 (strong signal).
   - `overallSeverity` is derived from `dv95`. A label is assigned:
     - `low` (<0.20), `moderate` (≥0.20), `high` (≥0.50), `critical` (≥0.80).

## Annotation system

The script returns geometry and per‑box enrichment; the frontend draws overlays.

Per‑box fields (in `boxInfo`):

- `x,y,w,h`: box geometry in candidate image coordinates.
- `areaFrac`: area / (image width × height).
- `aspect`: max(w,h) / min(w,h).
- `overlapCenterFrac`: fraction of the box that overlaps the central band.
- `boxFault`: one of `loose joint`, `wire overload`, `point overload` based on size/shape/center overlap.
- `avgDeltaV`, `maxDeltaV`: average and maximum brightness (V) delta within the box.
- `severity`: normalized severity in [0,1] based on `avgDeltaV`.
- `severityLabel`: `low` | `moderate` | `high` | `critical`.

Top‑level fields:

- `boxes`: filtered `[x,y,w,h]` list (geometry only).
- `boxInfo`: enriched metadata per box (see above).
- `faultType`: overall fault decided on the raw boxes (pre‑filter order).
- `prob`, `histDistance`, `dv95`, `warmFraction`, `imageWidth`, `imageHeight`.
- `overallSeverity`, `overallSeverityLabel`.
- `annotated`: currently an empty string; the UI renders overlays from `boxInfo`.

### How the UI uses annotations

- Draws rectangles for each entry in `boxInfo` using `x,y,w,h`.
- Legends by  `boxFault`.
- Filters by `faultType`.

## Backend persistence for annotations (actual schema)

The backend stores only a subset of AI results to keep the DB slim and editable by the UI. The authoritative schema is defined by JPA entities in `com.apexgrid.transformertracker.model`.

The relevant table is `inspections`, which has these AI-related columns:

1. Table: `inspections`

    - `boundingboxes` (text; JSON array of `[x,y,w,h]` in candidate coordinates)
    - `faulttypes` (text; JSON array of strings aligned with `boundingboxes`, e.g., `"loose joint"` | `"wire overload"` | `"point overload"`)

Behavior during analysis (`POST /api/inspections/{id}/analyze`):

- Select baseline from `transformers.(sunnyimage|cloudyimage|windyimage)` based on the `weather` parameter (fallback to any available baseline if exact match missing).
- Resize baseline to the candidate image dimensions, run `analyze.py`, then persist on the inspection:
- `lastanalysisweather` ← request `weather`
- `weather` ← request `weather` (kept in sync for convenience)
- `imageurl` ← data URL of the analyzed candidate image
- `boundingboxes` ← compact JSON string of `result.boxes`
- `faulttypes` ← JSON array built from `result.boxInfo[].boxFault` (aligned by order with boxes)

Annotation edit endpoints (server‑side):

- `POST /api/inspections/{id}/boxes` with body `{ x, y, w, h, faultType }` adds a box and appends the fault type to `faulttypes`.
- `DELETE /api/inspections/{id}/boxes/{index}` removes a box by index and removes the corresponding fault type.
- `DELETE /api/inspections/{id}/boxes?x=&y=&w=&h=` removes a box by geometry (with small tolerance) and updates `faulttypes` accordingly.
- `POST /api/inspections/{id}/clear-analysis` clears `imageurl`, `boundingboxes`, `faulttypes`, and `lastanalysisweather`.

## Known bugs / limitations

- Alignment fragility: SIFT may fail on low‑texture or uniform images; homography requires sufficient matches. We fall back to unaligned comparison.
- Hue‑based warm detection: The warm color heuristic assumes typical thermal palettes. Custom color maps or camera auto‑white‑balance may reduce accuracy.
- Brightness proxy: We use HSV V as a proxy for temperature; it’s not calibrated temperature. Lighting changes can influence results.
- Central‑band heuristic: `faultType` uses a middle‑third overlap heuristic. Off‑center faults may be labeled as `point overload` even if serious.
- Nested‑box filter: 50% overlap removal is simple; complex overlapping regions can still produce multiple adjacent boxes.
- Severity scaling: The [0.15, 0.50] delta‑to‑severity range is heuristic; different cameras or palettes might need tuning.
- Performance: Processing is per‑pixel in Python; very large images may be slow on CPU‑only systems.
- No mask propagation to UI: `valid_mask` is used internally but not returned; boxes fully outside valid areas are dropped, but the UI can’t display masked regions.

## Dependencies

- `opencv-contrib-python` (SIFT), `numpy`, `Pillow`.
- See `requirements.txt` for versions. If OpenCV‑contrib is unavailable, alignment is skipped.

## Local usage

```pwsh
python analyze.py baseline.png candidate.png > result.json
```
