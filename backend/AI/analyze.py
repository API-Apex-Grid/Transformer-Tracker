"""
Rule-based thermal comparison script.

Inputs:
- baseline.png
- candidate.png

Output (JSON to stdout):
- prob, histDistance, dv95, warmFraction, imageWidth, imageHeight,
  boxes, boxInfo, faultType, overallSeverity, overallSeverityLabel, annotated

Notes:
- 'annotated' is left empty; the UI renders overlays client-side.
"""
import sys
import json
import os
from typing import List, Tuple, Optional

from PIL import Image
import numpy as np

DEFAULT_PARAMS = {
    "h_bins": 30,
    "s_bins": 32,
    "sample_every": 10,
    "warm_hue_low": 0.17,
    "warm_hue_high": 0.95,
    "warm_sat_threshold": 0.30,
    "warm_val_threshold": 0.40,
    "contrast_threshold": 0.15,
    "min_area_ratio": 0.001,
    "min_area_pixels": 32,
    "hist_distance_scale": 0.5,
    "warm_fraction_scale": 2.0,
    "dv95_scale": 1.0,
    "dv95_percentile": 0.95,
    "loose_area_threshold": 0.10,
    "large_area_threshold": 0.30,
    "center_overlap_threshold": 0.40,
    "rectangular_aspect_threshold": 2.0,
    "severity_lower_delta": 0.15,
    "severity_upper_delta": 0.50,
    "severity_floor": 0.05,
    "crop_margin_pct": 0.05,
}


def load_params(config_path=None):
    params = DEFAULT_PARAMS.copy()

    env_payload = os.environ.get("TT_PARAMS")
    if env_payload:
        try:
            data = json.loads(env_payload)
            if isinstance(data, dict):
                for key, value in data.items():
                    if key in params and isinstance(value, (int, float)):
                        params[key] = value
        except Exception:
            pass

    if config_path and config_path not in ("", "__NO_PARAMS__"):
        try:
            with open(config_path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
                if isinstance(data, dict):
                    for key, value in data.items():
                        if key in params and isinstance(value, (int, float)):
                            params[key] = value
        except Exception:
            pass

    return params

def rgb_to_hsv(r, g, b):
    r_, g_, b_ = r / 255.0, g / 255.0, b / 255.0
    mx = max(r_, g_, b_)
    mn = min(r_, g_, b_)
    diff = mx - mn
    if diff == 0:
        h = 0.0
    elif mx == r_:
        h = (60 * ((g_ - b_) / diff) + 360) % 360
    elif mx == g_:
        h = (60 * ((b_ - r_) / diff) + 120) % 360
    else:
        h = (60 * ((r_ - g_) / diff) + 240) % 360
    s = 0.0 if mx == 0 else diff / mx
    v = mx
    return h / 360.0, s, v


def normalize_hist(hist: List[float]) -> None:
    s = sum(hist)
    if s > 0:
        for i in range(len(hist)):
            hist[i] /= s


def l2_distance(a: List[float], b: List[float]) -> float:
    return sum((ai - bi) * (ai - bi) for ai, bi in zip(a, b)) ** 0.5


def overlap_area(a: List[int], b: List[int]) -> int:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    ax1, ay1, bx1, by1 = ax + aw, ay + ah, bx + bw, by + bh
    ix0, iy0 = max(ax, bx), max(ay, by)
    ix1, iy1 = min(ax1, bx1), min(ay1, by1)
    w = max(0, ix1 - ix0)
    h = max(0, iy1 - iy0)
    return w * h


def severity_label(score: float) -> str:
    if score >= 0.80:
        return "critical"
    if score >= 0.50:
        return "high"
    if score >= 0.20:
        return "moderate"
    return "low"


def delta_to_severity(delta: float, severity_lo: float, severity_hi: float) -> float:
    if delta <= severity_lo:
        return 0.0
    if delta >= severity_hi:
        return 1.0
    return (delta - severity_lo) / (severity_hi - severity_lo)


def box_delta_stats(
    base_px,
    cand_px,
    box: Tuple[int, int, int, int],
    width: int,
    height: int,
) -> Tuple[float, float]:
    x, y, w, h = box
    sum_dv = 0.0
    max_dv = 0.0
    cnt = 0
    for yy in range(max(0, y), min(height, y + h)):
        for xx in range(max(0, x), min(width, x + w)):
            rB, gB, bB = base_px[xx, yy]
            rC, gC, bC = cand_px[xx, yy]
            _, _, vB = rgb_to_hsv(rB, gB, bB)
            _, _, vC = rgb_to_hsv(rC, gC, bC)
            dV = max(0.0, vC - vB)
            sum_dv += dV
            if dV > max_dv:
                max_dv = dV
            cnt += 1
    avg_dv = (sum_dv / cnt) if cnt > 0 else 0.0
    return avg_dv, max_dv


def classify_fault(
    img_w: int,
    img_h: int,
    boxes_list: List[List[int]],
    rectangular_aspect: float,
    loose_area_thresh: float,
    large_area_thresh: float,
    center_overlap_thresh: float,
):
    if not boxes_list:
        return "none", []

    # Define middle area as central third of the image
    center_x0, center_y0 = int(img_w * 0.33), int(img_h * 0.33)
    center_x1, center_y1 = int(img_w * 0.67), int(img_h * 0.67)
    total_area = float(img_w * img_h)

    info = []
    has_large_central = False
    has_rectangular = False
    max_area_frac = 0.0

    for (x, y, w, h) in boxes_list:
        area = float(w * h)
        area_frac = area / total_area if total_area > 0 else 0.0
        short_side = max(1.0, float(min(w, h)))
        long_side = float(max(w, h))
        aspect = long_side / short_side

        # central overlap check
        bx0, by0, bx1, by1 = x, y, x + w, y + h
        ox0, oy0 = max(bx0, center_x0), max(by0, center_y0)
        ox1, oy1 = min(bx1, center_x1), min(by1, center_y1)
        overlap = max(0, ox1 - ox0) * max(0, oy1 - oy0)
        overlap_frac = (overlap / area) if area > 0 else 0.0

        # Track maxima and shapes
        max_area_frac = max(max_area_frac, area_frac)
        if aspect >= rectangular_aspect:
            has_rectangular = True

        # Per-box label for annotation
        if area_frac >= loose_area_thresh:
            box_label = "Loose joint"
        elif aspect >= rectangular_aspect:
            box_label = "Wire overload"
        else:
            box_label = "Point overload"

        # Large central if box covers target fraction and overlaps center meaningfully
        if area_frac >= large_area_thresh and overlap_frac >= center_overlap_thresh:
            has_large_central = True

        info.append(
            {
                "x": int(x),
                "y": int(y),
                "w": int(w),
                "h": int(h),
                "areaFrac": float(area_frac),
                "aspect": float(aspect),
                "overlapCenterFrac": float(overlap_frac),
                "label": box_label,
            }
        )

    # Decide fault in specified order
    if has_large_central:
        return "loose joint", info
    if max_area_frac < large_area_thresh:
        return "point overload", info
    if has_rectangular:
        return "wire overload", info
    return "none", info


def crop_remove_lr(img: Image.Image, margin_pct: float) -> Image.Image:
    w, h = img.size
    margin = int(round(w * margin_pct))
    left = margin
    right = w - margin
    if right <= left:
        # fallback, don't crop if image too small
        return img
    return img.crop((left, 0, right, h))


def pil_to_cv_rgb(img: Image.Image):
    return np.array(img)  # RGB order


def align_by_sift_homography(src_pil: Image.Image, dst_pil: Image.Image):
    """
    Align src to dst using SIFT-based homography. Returns (aligned_src_pil, valid_mask_bool_2d).
    Note: This function imports OpenCV internally to avoid import errors if SIFT is disabled.
    """
    try:
        import cv2  # Local import to avoid hard dependency when disabled
    except Exception:
        return src_pil, None

    src_rgb = pil_to_cv_rgb(src_pil)
    dst_rgb = pil_to_cv_rgb(dst_pil)
    # Convert to grayscale for color-invariant keypoints/descriptors
    src_gray = cv2.cvtColor(src_rgb, cv2.COLOR_RGB2GRAY)
    dst_gray = cv2.cvtColor(dst_rgb, cv2.COLOR_RGB2GRAY)

    try:
        sift = cv2.SIFT_create()
    except Exception:
        # Fallback: return original if SIFT unavailable
        return src_pil, None

    kp1, des1 = sift.detectAndCompute(src_gray, None)
    kp2, des2 = sift.detectAndCompute(dst_gray, None)

    if des1 is None or des2 is None or len(kp1) < 4 or len(kp2) < 4:
        return src_pil, None

    matcher = cv2.BFMatcher(cv2.NORM_L2, crossCheck=False)
    matches = matcher.knnMatch(des1, des2, k=2)

    # Lowe's ratio test
    good = []
    for m_n in matches:
        if len(m_n) != 2:
            continue
        m, n = m_n
        if m.distance < 0.75 * n.distance:
            good.append(m)

    if len(good) < 4:
        return src_pil, None

    src_pts = np.float32([kp1[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
    dst_pts = np.float32([kp2[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)

    H, _ = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)
    if H is None:
        return src_pil, None

    h, w = dst_gray.shape
    warped = cv2.warpPerspective(src_rgb, H, (w, h), flags=cv2.INTER_LINEAR)
    # Build a valid mask by warping a full-ones mask and thresholding
    ones = np.ones((src_gray.shape[0], src_gray.shape[1]), dtype=np.uint8) * 255
    warped_mask = cv2.warpPerspective(ones, H, (w, h), flags=cv2.INTER_NEAREST)
    valid = (warped_mask > 0).astype(np.uint8)
    # Convert back to PIL (still RGB), return mask as 2D list of booleans
    valid_list = [[bool(v) for v in row] for row in valid.tolist()]
    return Image.fromarray(warped), valid_list


def analyze_pair(
    base_img: Image.Image,
    cand_img: Image.Image,
    params,
    valid_mask: Optional[List[List[bool]]] = None,
):
    W, H = cand_img.size

    h_bins = max(1, int(round(params.get("h_bins", DEFAULT_PARAMS["h_bins"]))))
    s_bins = max(1, int(round(params.get("s_bins", DEFAULT_PARAMS["s_bins"]))))
    hist_base = [0.0] * (h_bins * s_bins)
    hist_cand = [0.0] * (h_bins * s_bins)

    base_px = base_img.convert('RGB').load()
    cand_px = cand_img.convert('RGB').load()

    sample_every = max(1, int(round(params.get("sample_every", DEFAULT_PARAMS["sample_every"]))))
    dv_vals = []

    warm_hue_low = max(0.0, min(1.0, float(params.get("warm_hue_low", DEFAULT_PARAMS["warm_hue_low"]))))
    warm_hue_high = max(0.0, min(1.0, float(params.get("warm_hue_high", DEFAULT_PARAMS["warm_hue_high"]))))
    if warm_hue_high < warm_hue_low:
        warm_hue_high = warm_hue_low

    warm_sat_thr = max(0.0, min(1.0, float(params.get("warm_sat_threshold", DEFAULT_PARAMS["warm_sat_threshold"]))))
    warm_val_thr = max(0.0, min(1.0, float(params.get("warm_val_threshold", DEFAULT_PARAMS["warm_val_threshold"]))))
    contrast_thr = max(0.0, min(1.0, float(params.get("contrast_threshold", DEFAULT_PARAMS["contrast_threshold"]))))

    min_area_ratio = max(0.0, float(params.get("min_area_ratio", DEFAULT_PARAMS["min_area_ratio"])))
    min_area_pixels = max(1, int(round(params.get("min_area_pixels", DEFAULT_PARAMS["min_area_pixels"]))))

    hist_scale = float(params.get("hist_distance_scale", DEFAULT_PARAMS["hist_distance_scale"]))
    if hist_scale <= 1e-6:
        hist_scale = DEFAULT_PARAMS["hist_distance_scale"]
    warm_scale = float(params.get("warm_fraction_scale", DEFAULT_PARAMS["warm_fraction_scale"]))
    dv95_scale = float(params.get("dv95_scale", DEFAULT_PARAMS["dv95_scale"]))

    percentile = float(params.get("dv95_percentile", DEFAULT_PARAMS["dv95_percentile"]))
    percentile = min(0.999, max(0.5, percentile))

    loose_area_thresh = max(0.0, float(params.get("loose_area_threshold", DEFAULT_PARAMS["loose_area_threshold"])))
    large_area_thresh = max(loose_area_thresh, float(params.get("large_area_threshold", DEFAULT_PARAMS["large_area_threshold"])))
    center_overlap_thresh = max(0.0, min(1.0, float(params.get("center_overlap_threshold", DEFAULT_PARAMS["center_overlap_threshold"]))))
    rectangular_aspect = max(1.0, float(params.get("rectangular_aspect_threshold", DEFAULT_PARAMS["rectangular_aspect_threshold"])))

    severity_lo = float(params.get("severity_lower_delta", DEFAULT_PARAMS["severity_lower_delta"]))
    severity_hi = float(params.get("severity_upper_delta", DEFAULT_PARAMS["severity_upper_delta"]))
    if severity_hi <= severity_lo:
        severity_hi = severity_lo + 1e-6
    severity_floor = max(0.0, float(params.get("severity_floor", DEFAULT_PARAMS["severity_floor"])))

    mask = [[False] * W for _ in range(H)]
    if valid_mask is not None:
        valid_total = sum(1 for y in range(H) for x in range(W) if valid_mask[y][x])
        if valid_total <= 0:
            valid_total = W * H
    else:
        valid_total = W * H

    for y in range(H):
        for x in range(W):
            if valid_mask is not None and not valid_mask[y][x]:
                continue
            rB, gB, bB = base_px[x, y]
            rC, gC, bC = cand_px[x, y]
            hB, sB, vB = rgb_to_hsv(rB, gB, bB)
            hC, sC, vC = rgb_to_hsv(rC, gC, bC)

            hBinB = min(h_bins - 1, max(0, int(hB * h_bins)))
            sBinB = min(s_bins - 1, max(0, int(sB * s_bins)))
            hist_base[hBinB * s_bins + sBinB] += 1.0

            hBinC = min(h_bins - 1, max(0, int(hC * h_bins)))
            sBinC = min(s_bins - 1, max(0, int(sC * s_bins)))
            hist_cand[hBinC * s_bins + sBinC] += 1.0

            if ((x + y * W) % sample_every) == 0:
                dv_vals.append(max(0.0, vC - vB))

            warm_hue = (hC <= warm_hue_low) or (hC >= warm_hue_high)
            warm_sat = sC >= warm_sat_thr
            warm_val = vC >= warm_val_thr
            contrast = (vC - vB) >= contrast_thr
            mask[y][x] = warm_hue and warm_sat and warm_val and contrast

    normalize_hist(hist_base)
    normalize_hist(hist_cand)
    hist_dist = l2_distance(hist_base, hist_cand)

    dv_vals.sort()
    if dv_vals:
        idx = int(round(percentile * (len(dv_vals) - 1)))
        idx = max(0, min(len(dv_vals) - 1, idx))
        dv95 = dv_vals[idx]
    else:
        dv95 = 0.0

    warm_count = sum(1 for y in range(H) for x in range(W) if mask[y][x])
    warm_frac = warm_count/valid_total if valid_total > 0 else 0.0

    # Connected components to boxes
    visited = [[False]*W for _ in range(H)]
    dirs = [(1,0),(-1,0),(0,1),(0,-1)]
    boxes = []
    min_area = int((valid_total if valid_total > 0 else (W * H)) * min_area_ratio)
    min_area = max(min_area_pixels, min_area)
    if min_area < 1:
        min_area = 1

    from collections import deque
    for y in range(H):
        for x in range(W):
            if not mask[y][x] or visited[y][x]:
                continue
            q = deque([(x,y)])
            visited[y][x] = True
            minX = maxX = x
            minY = maxY = y
            area = 0
            while q:
                px, py = q.popleft()
                area += 1
                minX = min(minX, px)
                minY = min(minY, py)
                maxX = max(maxX, px)
                maxY = max(maxY, py)
                for dx, dy in dirs:
                    nx, ny = px+dx, py+dy
                    if nx < 0 or ny < 0 or nx >= W or ny >= H:
                        continue
                    if not visited[ny][nx] and mask[ny][nx]:
                        visited[ny][nx] = True
                        q.append((nx, ny))
            if area >= min_area:
                boxes.append([minX, minY, maxX-minX+1, maxY-minY+1])

    # Classify on raw boxes first
    fault_type_raw, _ = classify_fault(
        W,
        H,
        boxes,
        rectangular_aspect,
        loose_area_thresh,
        large_area_thresh,
        center_overlap_thresh,
    )

    # Filter nested boxes if 50% of a box area overlaps another (remove the inner)
    keep = [True] * len(boxes)
    areas = [w * h for (x, y, w, h) in boxes]
    for i in range(len(boxes)):
        if not keep[i]:
            continue
        for j in range(len(boxes)):
            if i == j or not keep[j]:
                continue
            inter = overlap_area(boxes[i], boxes[j])
            if areas[i] > 0 and inter / areas[i] >= 0.5:
                # i is 50% inside j
                keep[i] = False
                break
    filtered = [b for b, k in zip(boxes, keep) if k]

    # Score and prob
    score = (hist_dist / hist_scale) + (dv95 * dv95_scale) + (warm_frac * warm_scale)
    prob = 1.0 / (1.0 + pow(2.718281828, -score))

    # Now label each remaining (filtered) box and return their info
    _, box_info = classify_fault(
        W,
        H,
        filtered,
        rectangular_aspect,
        loose_area_thresh,
        large_area_thresh,
        center_overlap_thresh,
    )
    fault_type = fault_type_raw

    # Provide UI with geometry and labels; frontend will draw overlays
    # Map each box to a high-level fault type for filtering in UI
    enriched = []
    for bi in box_info:
        area_frac = bi['areaFrac']
        aspect = bi['aspect']
        overlap_center = bi['overlapCenterFrac']

        # Classify per-box fault type
        if area_frac >= loose_area_thresh and (overlap_center >= center_overlap_thresh or area_frac >= large_area_thresh):
            box_fault = 'loose joint'
        elif aspect >= rectangular_aspect:
            box_fault = 'wire overload'
        else:  # Default to point overload for other warm regions
            box_fault = 'point overload'

        # Compute severity based on average brightness (V) delta within the box
        # If a valid mask is provided, ensure we only accumulate within valid pixels
        if valid_mask is not None:
            x0, y0, bw, bh = bi['x'], bi['y'], bi['w'], bi['h']
            any_valid = False
            for yy in range(max(0, y0), min(H, y0 + bh)):
                for xx in range(max(0, x0), min(W, x0 + bw)):
                    if valid_mask[yy][xx]:
                        any_valid = True
                        break
                if any_valid:
                    break
            if not any_valid:
                # Skip boxes entirely outside valid region
                continue
        avg_dv, max_dv = box_delta_stats(
            base_px, cand_px, (bi['x'], bi['y'], bi['w'], bi['h']), W, H
        )
        sev = float(delta_to_severity(avg_dv, severity_lo, severity_hi))

        bi2 = dict(bi)
        bi2['boxFault'] = box_fault
        bi2['severity'] = max(sev, severity_floor)
        bi2['severityLabel'] = severity_label(sev)
        # Maintain previous API expected by frontend: brightness deltas in V channel
        bi2['avgDeltaV'] = float(avg_dv)
        bi2['maxDeltaV'] = float(max_dv)
        enriched.append(bi2)

    # Overall severity derived from dv95 (strong tail of temperature/brightness increase)
    overall_severity = float(delta_to_severity(dv95, severity_lo, severity_hi))

    return {
        'prob': float(prob),
        'histDistance': float(hist_dist),
        'dv95': float(dv95),
        'warmFraction': float(warm_frac),
        'imageWidth': int(W),
        'imageHeight': int(H),
        'boxes': filtered,
        'boxInfo': enriched,
        'faultType': fault_type,
        'overallSeverity': overall_severity,
        'overallSeverityLabel': severity_label(overall_severity),
        # annotated is now empty; UI will render overlays
        'annotated': '',
    }


def main():
    if len(sys.argv) not in (3, 4):
        print(json.dumps({'error': 'usage: analyze.py BASELINE CANDIDATE [PARAMS_JSON]'}))
        sys.exit(2)
    base_path, cand_path = sys.argv[1], sys.argv[2]
    config_path = sys.argv[3] if len(sys.argv) == 4 else None
    try:
        base_img = Image.open(base_path).convert('RGB')
        cand_img = Image.open(cand_path).convert('RGB')
        params = load_params(config_path)

        # SIFT alignment DISABLED by default.
        # To re-enable SIFT-based alignment, uncomment the following line and comment
        # out the two lines that set aligned_base and valid_mask to defaults.
        # margin_pct = float(params.get("crop_margin_pct", DEFAULT_PARAMS["crop_margin_pct"]))
        # margin_pct = max(0.0, min(0.2, margin_pct))
        # base_img = crop_remove_lr(base_img, margin_pct)
        # cand_img = crop_remove_lr(cand_img, margin_pct)
        # aligned_base, valid_mask = align_by_sift_homography(base_img, cand_img)

        aligned_base = base_img
        valid_mask = None

        # Continue with the remaining comparison using the (optionally aligned) baseline and the candidate
        res = analyze_pair(aligned_base, cand_img, params, valid_mask=valid_mask)
        print(json.dumps(res, separators=(',', ':')))
        sys.exit(0)
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
