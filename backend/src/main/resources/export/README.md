# Transformer Tracker Export Toolkit

## Contents

- `metadata.json`: JSON snapshot of the inspection, including current and
  historical bounding boxes, annotators, and severities.
- `history.csv`: Tabular view of the same snapshot data for quick analysis.
- `image-original.*`: The candidate image used for the current inspection.
- `baseline-<weather>.*` (optional): Baseline transformer image that matches the
  weather used during the last analysis.
- `tools/plot_bounding_boxes.py`: Helper script for visualising snapshots.

## Quick Start

1. Ensure Python 3.9+ is installed. The script depends on Pillow, which can be
   installed with:

   ```bash
   pip install Pillow
   ```

2. Extract the ZIP archive and change into the directory that contains
   `metadata.json`.

3. Render overlays for every snapshot using the provided script (replace the
   image extension with the one present in your export):

   ```bash
   python tools/plot_bounding_boxes.py metadata.json image-original.png --output-dir plots
   ```

   The script writes one image per snapshot to the output directory. Each
   bounding box is labelled with its fault classification and severity (when
   available). If a baseline image is present, you can render overlays on it as
   well:

   ```bash
   python tools/plot_bounding_boxes.py metadata.json image-original.png \
     --baseline baseline-sunny.png --output-dir plots
   ```

4. Review the generated PNG files inside the output directory to inspect how
   annotations changed over time.

## Tips

- `history.csv` lines align with the order shown in `metadata.json` and the visual
  outputs produced by the script.
- You can re-run the script at any time with a different `--output-dir` to compare
  alternative overlay parameters (e.g., `--alpha` for transparency adjustments).
