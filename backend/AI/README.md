# Image Alignment and Analysis

## Overview

This script performs thermal image analysis to detect and classify faults in transformers. The process involves aligning a baseline image with a candidate image and analyzing differences to identify warm regions, bounding boxes, and fault severities.

### Key Steps

1. **Preprocessing**:
   - Each input image is horizontally center-cropped by removing 5% from both the left and right sides.

2. **Alignment**:
   - Grayscale images are used to detect SIFT (Scale-Invariant Feature Transform) keypoints and descriptors.
   - Good matches are filtered using Lowe's ratio test.
   - A homography is computed with RANSAC and applied to warp the baseline image into the candidate's frame.

3. **Analysis**:
   - Histogram distances are calculated between the baseline and candidate images in the HSV color space.
   - Warm regions are identified based on hue, saturation, brightness, and contrast thresholds.
   - Bounding boxes are generated for connected warm regions, and their areas and shapes are analyzed.
   - Fault severities are computed based on brightness deltas within the bounding boxes.

4. **Fallback**:
   - If SIFT or OpenCV-contrib is unavailable, the script skips alignment and directly compares the images.

## Outputs

The script generates the following outputs:

- **Histogram Distance**: Quantifies the overall color difference between the images.
- **Warm Fraction**: The proportion of the image identified as warm.
- **Bounding Boxes**: Regions of interest with fault classifications (e.g., loose joint, wire overload, point overload).
- **Fault Severity**: A normalized score indicating the severity of detected faults.

## Dependencies

- OpenCV (cv2)
- NumPy
- Pillow

## Installation

Run the following command inside the `backend/AI` directory to install dependencies:

```pwsh
pip install -r requirements.txt
```

## Notes

- If `opencv-contrib-python` cannot be installed in your environment, the script will skip the alignment step and proceed with the analysis.

- Ensure that the input images are in a compatible format (e.g., PNG, JPEG) and have similar dimensions for optimal results.
