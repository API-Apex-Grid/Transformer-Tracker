"""Parameter tuning helper.

Arguments:
 1. candidate image path (PNG)
 2. context payload JSON path

Reads bounding box feedback and current parameters, computes per-box metrics,
then emits JSON with `parameter_updates` (delta per parameter) and `notes`.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import cv2
import numpy as np
from PIL import Image

SATURATION_MARGIN = 0.01
VALUE_MARGIN = 0.01
CONTRAST_MARGIN = 0.01
HUE_STEP = 0.01
AREA_RATIO_STEP = 0.0005


def load_payload(payload_path: Path) -> Dict:
    with payload_path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def load_image(image_path: Path) -> Tuple[np.ndarray, np.ndarray]:
    image = Image.open(image_path).convert("RGB")
    rgb = np.asarray(image, dtype=np.float32) / 255.0
    # cv2 expects BGR order
    hsv = cv2.cvtColor(rgb[:, :, ::-1], cv2.COLOR_BGR2HSV)
    hsv[:, :, 0] = hsv[:, :, 0] / 180.0  # Normalize hue to [0, 1]
    return rgb, hsv


def measure_box(box: Iterable[float],
                hsv: np.ndarray,
                mean_value: float,
                warm_low: float,
                warm_high: float) -> Dict:
    x, y, w, h = [float(v) for v in box]
    height, width = hsv.shape[:2]
    x0 = max(0, int(math.floor(x)))
    y0 = max(0, int(math.floor(y)))
    x1 = min(width, int(math.ceil(x + w)))
    y1 = min(height, int(math.ceil(y + h)))
    if x1 <= x0 or y1 <= y0:
        return {}

    region = hsv[y0:y1, x0:x1]
    if region.size == 0:
        return {}

    s = region[:, :, 1]
    v = region[:, :, 2]
    h_channel = region[:, :, 0]

    pixel_count = float(region.shape[0] * region.shape[1])
    total_pixels = float(height * width)

    mean_sat = float(np.mean(s))
    mean_val = float(np.mean(v))
    mean_delta = float(np.mean(v - mean_value))

    warm_mask = np.logical_or(h_channel <= warm_low, h_channel >= warm_high)
    warm_fraction = float(np.sum(warm_mask)) / pixel_count if pixel_count else 0.0

    angles = h_channel * (2.0 * math.pi)
    sum_sin = float(np.sin(angles).sum())
    sum_cos = float(np.cos(angles).sum())
    mean_hue = math.atan2(sum_sin, sum_cos) / (2.0 * math.pi)
    if mean_hue < 0.0:
        mean_hue += 1.0

    max_val = float(v.max()) if pixel_count else 0.0

    return {
        "pixel_count": pixel_count,
        "area_ratio": pixel_count / total_pixels if total_pixels else 0.0,
        "mean_saturation": mean_sat,
        "mean_value": mean_val,
        "mean_delta_value": mean_delta,
        "warm_fraction": warm_fraction,
        "mean_hue": mean_hue,
        "max_value": max_val,
    }


def adjustments_for_feedback(added_metrics: List[Dict],
                             removed_metrics: List[Dict],
                             params: Dict[str, float]) -> Dict[str, float]:
    updates: Dict[str, float] = {}
    working = dict(params)

    def current(key: str) -> float:
        return float(working.get(key, params.get(key, 0.0)))

    def apply(key: str, delta: float) -> None:
        if not delta:
            return
        updates[key] = updates.get(key, 0.0) + delta
        working[key] = current(key) + delta

    def adjust_added(metrics: Dict) -> None:
        if not metrics:
            return
        sat_diff = current("warm_sat_threshold") - metrics["mean_saturation"]
        if sat_diff > SATURATION_MARGIN:
            delta = -min(0.05, max(0.005, sat_diff * 0.5))
            apply("warm_sat_threshold", delta)

        val_diff = current("warm_val_threshold") - metrics["mean_value"]
        if val_diff > VALUE_MARGIN:
            delta = -min(0.05, max(0.005, val_diff * 0.5))
            apply("warm_val_threshold", delta)

        contrast_diff = current("contrast_threshold") - metrics["mean_delta_value"]
        if contrast_diff > CONTRAST_MARGIN:
            delta = -min(0.05, max(0.003, contrast_diff * 0.5))
            apply("contrast_threshold", delta)

        pixel_diff = current("min_area_pixels") - metrics["pixel_count"]
        if pixel_diff > 1.0:
            delta = -min(50.0, max(5.0, pixel_diff * 0.25))
            apply("min_area_pixels", delta)

        ratio_diff = current("min_area_ratio") - metrics["area_ratio"]
        if ratio_diff > 0.0:
            delta = -min(0.005, max(AREA_RATIO_STEP, ratio_diff * 0.5))
            apply("min_area_ratio", delta)

        if metrics["warm_fraction"] >= 0.5:
            hue = metrics["mean_hue"]
            warm_low = current("warm_hue_low")
            warm_high = current("warm_hue_high")
            if hue < 0.5 and hue > warm_low:
                delta = min(HUE_STEP, (hue - warm_low) * 0.5)
                apply("warm_hue_low", delta)
            elif hue >= 0.5 and hue < warm_high:
                delta = -min(HUE_STEP, (warm_high - hue) * 0.5)
                apply("warm_hue_high", delta)

    def adjust_removed(metrics: Dict) -> None:
        if not metrics:
            return
        sat_diff = metrics["mean_saturation"] - current("warm_sat_threshold")
        if sat_diff < -SATURATION_MARGIN:
            delta = min(0.05, max(0.005, -sat_diff * 0.5))
            apply("warm_sat_threshold", delta)

        val_diff = metrics["mean_value"] - current("warm_val_threshold")
        if val_diff < -VALUE_MARGIN:
            delta = min(0.05, max(0.005, -val_diff * 0.5))
            apply("warm_val_threshold", delta)

        contrast_diff = metrics["mean_delta_value"] - current("contrast_threshold")
        if contrast_diff < -CONTRAST_MARGIN:
            delta = min(0.05, max(0.003, -contrast_diff * 0.5))
            apply("contrast_threshold", delta)

        if metrics["pixel_count"] < current("min_area_pixels") * 1.2:
            delta = min(50.0, max(5.0, (current("min_area_pixels") - metrics["pixel_count"]) * 0.2))
            apply("min_area_pixels", delta)

        if metrics["area_ratio"] < current("min_area_ratio") * 1.2:
            apply("min_area_ratio", AREA_RATIO_STEP)

        if metrics["warm_fraction"] >= 0.5:
            hue = metrics["mean_hue"]
            warm_low = current("warm_hue_low")
            warm_high = current("warm_hue_high")
            if hue < warm_low:
                delta = -min(HUE_STEP, (warm_low - hue) * 0.5)
                apply("warm_hue_low", delta)
            elif hue > warm_high:
                delta = min(HUE_STEP, (hue - warm_high) * 0.5)
                apply("warm_hue_high", delta)

    for m in added_metrics:
        adjust_added(m)
    for m in removed_metrics:
        adjust_removed(m)

    # Remove tiny updates that would be no-ops after clamping
    return {k: v for k, v in updates.items() if abs(v) >= 1e-6}


def summarize(added_metrics: List[Dict], removed_metrics: List[Dict]) -> str:
    def mean(values: Iterable[float]) -> float:
        seq = list(values)
        return float(sum(seq) / len(seq)) if seq else float("nan")

    def fmt(value: float) -> str:
        if not math.isfinite(value):
            return "nan"
        return f"{value:.3f}"

    notes = [
        f"added={len(added_metrics)}",
        f"removed={len(removed_metrics)}",
    ]
    if added_metrics:
        notes.extend([
            f"add_sat={fmt(mean(m['mean_saturation'] for m in added_metrics))}",
            f"add_val={fmt(mean(m['mean_value'] for m in added_metrics))}",
            f"add_area={fmt(mean(m['area_ratio'] for m in added_metrics))}",
        ])
    if removed_metrics:
        notes.extend([
            f"rem_sat={fmt(mean(m['mean_saturation'] for m in removed_metrics))}",
            f"rem_val={fmt(mean(m['mean_value'] for m in removed_metrics))}",
            f"rem_area={fmt(mean(m['area_ratio'] for m in removed_metrics))}",
        ])
    return " ".join(notes)


def main(argv: List[str]) -> int:
    if len(argv) != 3:
        print(json.dumps({"error": "expected arguments: candidate.png payload.json"}))
        return 1

    image_path = Path(argv[1])
    payload_path = Path(argv[2])

    payload = load_payload(payload_path)
    params = {k: float(v) for k, v in payload.get("parameters", {}).items()}

    _, hsv = load_image(image_path)
    mean_value = float(np.mean(hsv[:, :, 2]))

    warm_low = float(params.get("warm_hue_low", 0.17))
    warm_high = float(params.get("warm_hue_high", 0.95))

    added_boxes = payload.get("addedBoxes") or []
    removed_boxes = payload.get("removedBoxes") or []

    added_metrics = [
        m for m in (measure_box(box, hsv, mean_value, warm_low, warm_high) for box in added_boxes)
        if m
    ]
    removed_metrics = [
        m for m in (measure_box(box, hsv, mean_value, warm_low, warm_high) for box in removed_boxes)
        if m
    ]

    updates = adjustments_for_feedback(added_metrics, removed_metrics, params)
    notes = summarize(added_metrics, removed_metrics)

    result = {
        "parameter_updates": updates,
        "notes": notes,
        "addedCount": len(added_metrics),
        "removedCount": len(removed_metrics),
    }
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
