"""
Rule-based thermal comparison script.
Input: baseline.png candidate.png
Output: JSON to stdout with keys: prob, histDistance, dv95, warmFraction, boxes, annotated
- annotated is a data URL (image/png)
"""
import sys
import json
import base64
import io
from PIL import Image, ImageDraw

def rgb_to_hsv(r, g, b):
    r_, g_, b_ = r/255.0, g/255.0, b/255.0
    mx = max(r_, g_, b_)
    mn = min(r_, g_, b_)
    diff = mx - mn
    if diff == 0:
        h = 0.0
    elif mx == r_:
        h = (60 * ((g_-b_)/diff) + 360) % 360
    elif mx == g_:
        h = (60 * ((b_-r_)/diff) + 120) % 360
    else:
        h = (60 * ((r_-g_)/diff) + 240) % 360
    s = 0.0 if mx == 0 else diff / mx
    v = mx
    return h/360.0, s, v


def analyze_pair(base_img: Image.Image, cand_img: Image.Image):
    W, H = cand_img.size
    # Hist parameters
    h_bins, s_bins = 30, 32
    hist_base = [0.0]*(h_bins*s_bins)
    hist_cand = [0.0]*(h_bins*s_bins)

    # Prepare pixel access
    base_px = base_img.convert('RGB').load()
    cand_px = cand_img.convert('RGB').load()

    # dv95 sampling approx 10% pixels
    sample_every = 10
    dv_vals = []

    # Warm mask
    mask = [[False]*W for _ in range(H)]

    for y in range(H):
        for x in range(W):
            rB, gB, bB = base_px[x, y]
            rC, gC, bC = cand_px[x, y]
            hB, sB, vB = rgb_to_hsv(rB, gB, bB)
            hC, sC, vC = rgb_to_hsv(rC, gC, bC)

            hBinB = min(h_bins-1, max(0, int(hB*h_bins)))
            sBinB = min(s_bins-1, max(0, int(sB*s_bins)))
            hist_base[hBinB*s_bins + sBinB] += 1.0

            hBinC = min(h_bins-1, max(0, int(hC*h_bins)))
            sBinC = min(s_bins-1, max(0, int(sC*s_bins)))
            hist_cand[hBinC*s_bins + sBinC] += 1.0

            if ((x + y*W) % sample_every) == 0:
                dv_vals.append(max(0.0, vC - vB))

            warm_hue = (hC <= 0.17) or (hC >= 0.95)
            warm_sat = sC >= 0.3
            warm_val = vC >= 0.4
            contrast = (vC - vB) >= 0.15
            mask[y][x] = warm_hue and warm_sat and warm_val and contrast

    def normalize(hist):
        s = sum(hist)
        if s > 0:
            for i in range(len(hist)):
                hist[i] /= s

    def l2(a, b):
        return sum((ai-bi)*(ai-bi) for ai, bi in zip(a, b)) ** 0.5

    normalize(hist_base)
    normalize(hist_cand)
    hist_dist = l2(hist_base, hist_cand)

    dv_vals.sort()
    if dv_vals:
        idx = round(0.95*(len(dv_vals)-1))
        dv95 = dv_vals[idx]
    else:
        dv95 = 0.0

    warm_count = sum(1 for y in range(H) for x in range(W) if mask[y][x])
    warm_frac = warm_count/(W*H)

    # Connected components to boxes
    visited = [[False]*W for _ in range(H)]
    dirs = [(1,0),(-1,0),(0,1),(0,-1)]
    boxes = []
    min_area = max(32, int(W*H*0.001))

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

    # First, classify potential faults BEFORE filtering (per user request order)
    # This gives us an overall faultType derived from the raw candidate boxes.
    def classify_fault(img_w, img_h, boxes_list):
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
            if aspect >= 2.0:
                has_rectangular = True

            # Per-box label for annotation
            if area_frac >= 0.10:
                box_label = 'Loose joint'
            elif aspect >= 2.0:
                box_label = 'Wire overload'
            else:
                box_label = 'Point overload'

            # Large central if box covers >=30% and overlaps center meaningfully
            if area_frac >= 0.30 and overlap_frac >= 0.4:
                has_large_central = True

            info.append({
                'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h),
                'areaFrac': float(area_frac), 'aspect': float(aspect),
                'overlapCenterFrac': float(overlap_frac), 'label': box_label
            })

        # Decide fault in specified order
        if has_large_central:
            return "loose joint", info
        if max_area_frac < 0.30:
            return "point overload", info
        if has_rectangular:
            return "wire overload", info
        return "none", info

    # Classify on raw boxes first
    fault_type_raw, _ = classify_fault(W, H, boxes)

    # Filter nested boxes if 80% of a box area overlaps another (remove the inner)
    def overlap_area(a, b):
        ax, ay, aw, ah = a
        bx, by, bw, bh = b
        ax1, ay1, bx1, by1 = ax + aw, ay + ah, bx + bw, by + bh
        ix0, iy0 = max(ax, bx), max(ay, by)
        ix1, iy1 = min(ax1, bx1), min(ay1, by1)
        w = max(0, ix1 - ix0)
        h = max(0, iy1 - iy0)
        return w * h

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
    score = (hist_dist/0.5) + dv95 + (warm_frac*2.0)
    prob = 1.0 / (1.0 + pow(2.718281828, -score))

    # Now label each remaining (filtered) box and return their info
    _, box_info = classify_fault(W, H, filtered)
    fault_type = fault_type_raw

    # Provide UI with geometry and labels; frontend will draw overlays
    # Map each box to a high-level fault type for filtering in UI
    enriched = []

    # Helper to compute per-box average and max brightness delta (as proxy for temperature difference)
    def box_delta_stats(box):
        x, y, w, h = box
        sum_dc = 0.0
        max_dc = 0.0
        cnt = 0
        for yy in range(max(0, y), min(H, y + h)):
            for xx in range(max(0, x), min(W, x + w)):
                rB, gB, bB = base_px[xx, yy]
                rC, gC, bC = cand_px[xx, yy]
                hB, _, _ = rgb_to_hsv(rB, gB, bB)
                hC, _, _ = rgb_to_hsv(rC, gC, bC)
                dC = max(0.0, hC - hB)
                sum_dc += dC
                if dC > max_dc:
                    max_dc = dC
                cnt += 1
        avg_dc = (sum_dc / cnt) if cnt > 0 else 0.0
        return avg_dc, max_dc

    # Severity mapping: normalize brightness delta to [0,1] where 0.15 is minimal noticeable contrast
    def delta_to_severity(delta):
        # Treat 0.15 as threshold to start severity, and 0.50 as strong signal
        lo, hi = 0.15, 0.50
        if delta <= lo:
            return 0.0
        if delta >= hi:
            return 1.0
        return (delta - lo) / (hi - lo)

    def severity_label(score):
        if score >= 0.80:
            return 'critical'
        if score >= 0.50:
            return 'high'
        if score >= 0.20:
            return 'moderate'
        return 'low'
    for bi in box_info:
        area_frac = bi['areaFrac']
        aspect = bi['aspect']
        overlap_center = bi['overlapCenterFrac']
        
        # This logic seems more aligned with user intent.
        if area_frac >= 0.10 and (overlap_center >= 0.4 or area_frac >= 0.30):
            box_fault = 'loose joint'
        elif aspect >= 2.0:
            box_fault = 'wire overload'
        else: # Default to point overload for other warm regions
            box_fault = 'point overload'
        # Compute severity based on average brightness delta within the box
        avg_dc, max_dc = box_delta_stats((bi['x'], bi['y'], bi['w'], bi['h']))
        sev = float(delta_to_severity(avg_dc))
        bi2 = dict(bi)
        bi2['boxFault'] = box_fault
        bi2['severity'] = max(sev, 0.05)
        bi2['severityLabel'] = severity_label(sev)
        bi2['avgDeltaC'] = float(avg_dc)
        bi2['maxDeltaC'] = float(max_dc)
        enriched.append(bi2)

    # Overall severity derived from dv95 (strong tail of temperature/brightness increase)
    overall_severity = float(delta_to_severity(dv95))

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
    if len(sys.argv) != 3:
        print(json.dumps({'error': 'usage: analyze.py BASELINE CANDIDATE'}))
        sys.exit(2)
    base_path, cand_path = sys.argv[1], sys.argv[2]
    try:
        base_img = Image.open(base_path)
        cand_img = Image.open(cand_path)
        # Ensure both images are the same size by center cropping
        base_width, base_height = base_img.size
        cand_width, cand_height = cand_img.size

        crop_width = min(base_width, cand_width)
        crop_height = min(base_height, cand_height)

        def center_crop(img, target_width, target_height):
            width, height = img.size
            left = (width - target_width) // 2
            top = (height - target_height) // 2
            right = left + target_width
            bottom = top + target_height
            return img.crop((left, top, right, bottom))

        base_img = center_crop(base_img, crop_width, crop_height)
        cand_img = center_crop(cand_img, crop_width, crop_height)

        # Expect same size (backend resizes baseline to candidate size already)
        res = analyze_pair(base_img, cand_img)
        print(json.dumps(res, separators=(',', ':')))
        sys.exit(0)
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
