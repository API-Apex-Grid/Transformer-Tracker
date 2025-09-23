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
            warm_sat = sC >= 0.35
            warm_val = vC >= 0.5
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

    # Filter contained boxes
    def contains(outer, inner):
        ox, oy, ow, oh = outer
        ix, iy, iw, ih = inner
        return ix >= ox and iy >= oy and (ix+iw) <= (ox+ow) and (iy+ih) <= (oy+oh)

    filtered = []
    for i in range(len(boxes)):
        a = boxes[i]
        if not any(i != j and contains(boxes[j], a) for j in range(len(boxes))):
            filtered.append(a)

    # Score and prob
    score = (hist_dist/0.5) + dv95 + (warm_frac*2.0)
    prob = 1.0 / (1.0 + pow(2.718281828, -score))

    # Annotate candidate
    annotated = cand_img.convert('RGB').copy()
    dr = ImageDraw.Draw(annotated)
    for b in filtered:
        x, y, w, h = b
        dr.rectangle([x, y, x+w, y+h], outline=(255,0,0), width=2)

    buf = io.BytesIO()
    annotated.save(buf, format='PNG')
    b64 = base64.b64encode(buf.getvalue()).decode('ascii')
    data_url = f"data:image/png;base64,{b64}"

    return {
        'prob': float(prob),
        'histDistance': float(hist_dist),
        'dv95': float(dv95),
        'warmFraction': float(warm_frac),
        'boxes': filtered,
        'annotated': data_url,
    }


def main():
    if len(sys.argv) != 3:
        print(json.dumps({'error': 'usage: analyze.py BASELINE CANDIDATE'}))
        sys.exit(2)
    base_path, cand_path = sys.argv[1], sys.argv[2]
    try:
        base_img = Image.open(base_path)
        cand_img = Image.open(cand_path)
        # Expect same size (backend resizes baseline to candidate size already)
        res = analyze_pair(base_img, cand_img)
        print(json.dumps(res, separators=(',', ':')))
        sys.exit(0)
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
