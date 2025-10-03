# Image Alignment and Analysis

- Each input image is horizontally center-cropped by removing 5% from both left and right.
- SIFT keypoints/descriptors are detected on grayscale images.
- Good matches are filtered via Lowe's ratio test; a homography is computed with RANSAC and applied to warp the baseline into the candidate's frame.
- The rest of the analysis (histogram distance, warm regions, boxes, severities) is performed on the aligned baseline vs candidate without resizing to a common size.

Dependencies:

- OpenCV (cv2)
- NumPy
- Pillow

Install (inside backend/AI):

```pwsh
pip install -r requirements.txt
```

If you cannot install opencv-contrib-python in your environment, the script will fallback to skipping alignment.
