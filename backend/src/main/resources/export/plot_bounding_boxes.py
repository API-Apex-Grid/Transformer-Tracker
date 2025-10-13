"""
Render snapshot bounding boxes with fault labels and severities.

Usage:
    python plot_bounding_boxes.py metadata.json image-original.png \
        --output-dir plots [--baseline baseline-sunny.png]

The script reads the JSON export created by the Transformer Tracker backend
(metadata.json) and draws overlays for every snapshot recorded in the
"history" array.  Each bounding box is rendered with its fault classification
and, when available, the severity value.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Iterable, List, Sequence, Tuple

from PIL import Image, ImageDraw, ImageFont

FaultColor = Tuple[int, int, int]
Box = Tuple[float, float, float, float]


COLOR_MAP = {
    "loose joint": (239, 68, 68),
    "point overload": (245, 158, 11),
    "wire overload": (59, 130, 246),
}
DEFAULT_COLOR: FaultColor = (16, 185, 129)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render bounding box overlays for an inspection export")
    parser.add_argument("metadata", type=Path, help="Path to metadata.json from the export")
    parser.add_argument("image", type=Path, help="Candidate image (image-original.* from the export)")
    parser.add_argument(
        "--baseline",
        type=Path,
        default=None,
        help="Optional baseline image to render alongside the candidate",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("plots"),
        help="Directory to write rendered overlays (default: ./plots)",
    )
    parser.add_argument(
        "--alpha",
        type=float,
        default=0.35,
        help="Fill opacity for bounding boxes (0..1, default: 0.35)",
    )
    parser.add_argument(
        "--dpi",
        type=int,
        default=96,
        help="DPI hint for Pillow text rendering (default: 96)",
    )
    return parser.parse_args()


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def slugify(value: str) -> str:
    if not value:
        return "snapshot"
    safe = []
    for ch in value:
        if ch.isalnum() or ch in ("-", "_"):
            safe.append(ch)
        elif ch in (" ", ":", "/", "\\", "."):
            safe.append("-")
    result = "".join(safe).strip("-")
    return result or "snapshot"


def coerce_float(value) -> float | None:
    try:
        if value is None:
            return None
        result = float(value)
        return result
    except (TypeError, ValueError):
        return None


def parse_boxes(node) -> List[Box]:
    boxes: List[Box] = []
    if isinstance(node, Sequence):
        for entry in node:
            if isinstance(entry, Sequence) and len(entry) >= 4:
                try:
                    x = float(entry[0])
                    y = float(entry[1])
                    w = float(entry[2])
                    h = float(entry[3])
                except (TypeError, ValueError):
                    continue
                boxes.append((x, y, w, h))
    return boxes


def parse_strings(node, expected: int) -> List[str]:
    values: List[str] = []
    if isinstance(node, Sequence):
        for entry in node:
            if isinstance(entry, str):
                values.append(entry)
            elif entry is None:
                values.append("")
            else:
                values.append(str(entry))
    if len(values) < expected:
        values.extend("" for _ in range(expected - len(values)))
    return values[:expected]


def parse_numbers(node, expected: int) -> List[float | None]:
    values: List[float | None] = []
    if isinstance(node, Sequence):
        for entry in node:
            values.append(coerce_float(entry))
    if len(values) < expected:
        values.extend(None for _ in range(expected - len(values)))
    return values[:expected]


def fault_to_color(label: str) -> FaultColor:
    if not label:
        return DEFAULT_COLOR
    return COLOR_MAP.get(label.lower(), DEFAULT_COLOR)


def build_label_text(fault: str, severity: float | None) -> str:
    clean_fault = fault or "unknown"
    if severity is None:
        return clean_fault
    return f"{clean_fault} ({severity:.2f})"


def ensure_rgba(image: Image.Image) -> Image.Image:
    return image.convert("RGBA") if image.mode != "RGBA" else image.copy()


def get_text_size(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> Tuple[int, int]:
    """Return (width, height) of rendered text.

    Pillow has changed text measurement APIs across versions. Try multiple
    fallbacks to be robust: ImageDraw.textsize, ImageFont.getsize,
    ImageDraw.textbbox, ImageFont.getbbox.
    """
    # 1) ImageDraw.textsize (older/newer versions may or may not have it)
    try:
        size = draw.textsize(text, font=font)  # type: ignore[attr-defined]
        if isinstance(size, tuple) and len(size) == 2:
            return int(size[0]), int(size[1])
    except Exception:
        pass

    # 2) ImageFont.getsize
    try:
        size = font.getsize(text)
        if isinstance(size, tuple) and len(size) == 2:
            return int(size[0]), int(size[1])
    except Exception:
        pass

    # 3) ImageDraw.textbbox -> (left, top, right, bottom)
    try:
        bbox = draw.textbbox((0, 0), text, font=font)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        return int(w), int(h)
    except Exception:
        pass

    # 4) ImageFont.getbbox
    try:
        bbox = font.getbbox(text)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        return int(w), int(h)
    except Exception:
        pass

    return 0, 0


def render_overlay(
    base_image: Image.Image,
    boxes: Iterable[Box],
    faults: Iterable[str],
    severities: Iterable[float | None],
    alpha: float,
    font: ImageFont.ImageFont,
) -> Image.Image:
    canvas = ensure_rgba(base_image)
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    for (box, fault, severity) in zip(boxes, faults, severities):
        x, y, w, h = box
        x2 = x + w
        y2 = y + h
        color = fault_to_color(str(fault))
        outline = (*color, 255)
        fill = (*color, max(0, min(255, int(alpha * 255))))
        draw.rectangle([x, y, x2, y2], outline=outline, width=3, fill=fill)

        # Semi-transparent top bar for the label
        text = build_label_text(str(fault), severity)
        text_w, text_h = get_text_size(draw, text, font)
        pad = 4
        label_box = [x, max(0, y - text_h - pad), x + text_w + 2 * pad, max(0, y)]
        draw.rectangle(label_box, fill=fill)
        # Use integer coordinates for text placement
        draw.text((int(label_box[0] + pad), int(label_box[1] + pad / 2)), text, fill="white", font=font)

    composite = Image.alpha_composite(canvas, overlay)
    return composite.convert("RGB")


def main() -> None:
    args = parse_args()
    metadata = load_json(args.metadata)
    history = metadata.get("history") or []
    if not history:
        raise SystemExit("No history entries found in metadata.json")

    candidate = Image.open(args.image).convert("RGB")
    baseline = None
    if args.baseline:
        if not args.baseline.exists():
            raise SystemExit(f"Baseline image not found: {args.baseline}")
        baseline = Image.open(args.baseline).convert("RGB")

    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    font = ImageFont.load_default()

    for index, entry in enumerate(history):
        boxes = parse_boxes(entry.get("boundingBoxes"))
        faults = parse_strings(entry.get("faultTypes"), len(boxes))
        severities = parse_numbers(entry.get("severity"), len(boxes))
        timestamp = entry.get("timestamp") or ""
        is_current = bool(entry.get("isCurrent"))
        slug = slugify(timestamp)
        prefix = f"{index:02d}-{'current' if is_current else 'history'}-{slug}"

        result_candidate = render_overlay(candidate, boxes, faults, severities, args.alpha, font)
        candidate_path = output_dir / f"{prefix}-candidate.png"
        result_candidate.save(candidate_path)

        message = f"Rendered snapshot {index} -> {candidate_path.name}"

        if baseline is not None:
            result_baseline = render_overlay(baseline, boxes, faults, severities, args.alpha, font)
            baseline_path = output_dir / f"{prefix}-baseline.png"
            result_baseline.save(baseline_path)
            message += f", {baseline_path.name}"

        print(message)


if __name__ == "__main__":
    main()
