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
