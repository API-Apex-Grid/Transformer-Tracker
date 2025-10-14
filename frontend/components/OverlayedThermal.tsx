/*
  We intentionally use a raw <img> tag here to enable custom zoom/pan via CSS transforms.
  next/image imposes layout constraints and intercepts intrinsic sizing that conflict with
  our zoom math (scale and translate based on the image's natural dimensions). If we migrate
  this component to next/image in the future, we must preserve exact pixel sizing and prevent
  layout shifts under transforms.
*/
/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useMemo, useRef, useState, useEffect, useLayoutEffect } from "react";

export type OverlayBoxInfo = {
  x: number; y: number; w: number; h: number;
  label?: string;
  boxFault?: "loose joint" | "point overload" | "wire overload" | "none" | string;
  comment?: string | null;
};

export type OverlayToggles = {
  looseJoint: boolean;
  pointOverload: boolean;
  wireOverload: boolean;
};

interface OverlayedThermalProps {
  imageUrl: string;
  naturalWidth?: number; // optional external hint; component will infer automatically if not provided
  naturalHeight?: number; // optional external hint; component will infer automatically if not provided
  boxes: number[][] | number[];
  boxInfo?: OverlayBoxInfo[];
  toggles: OverlayToggles;
  containerClassName?: string;
  // Optional: called with (index) when user requests to remove a box from view
  onRemoveBox?: (index: number, box?: { x: number; y: number; w: number; h: number }) => void;
  // Optional: enable draw mode to create new boxes by dragging on the image
  allowDraw?: boolean;
  // Called when a new rectangle has been drawn
  onDrawComplete?: (box: { x: number; y: number; w: number; h: number }) => void;
  // Optional key; when this changes, the viewer will re-center once like on first mount
  resetKey?: string | number;
  // Optional: called when user requests to edit an existing box
  onSelectBox?: (index: number, box: { x: number; y: number; w: number; h: number }) => void;
}

function is2DArray(a: unknown): a is number[][] {
  return Array.isArray(a) && (a.length === 0 || Array.isArray(a[0]));
}

const OverlayedThermal: React.FC<OverlayedThermalProps> = ({
  imageUrl,
  naturalWidth,
  naturalHeight,
  boxes,
  boxInfo,
  toggles,
  containerClassName,
  onRemoveBox,
  allowDraw,
  onDrawComplete,
  resetKey,
  onSelectBox,
}) => {

  // Track actual image natural dimensions to compute relative box positions
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const list = useMemo(() => {
  const rawBoxes: Array<{x:number;y:number;w:number;h:number}> = [];
    if (is2DArray(boxes)) {
      for (const b of boxes as number[][]) {
        if (b.length >= 4) rawBoxes.push({ x: b[0], y: b[1], w: b[2], h: b[3] });
      }
    }
    const infosByKey = new Map<string, OverlayBoxInfo>();
    (boxInfo ?? []).forEach((bi) => {
      const key = `${bi.x},${bi.y},${bi.w},${bi.h}`;
      infosByKey.set(key, bi);
    });
    // Detect if boxes appear to be normalized (0..1). If so, convert to pixels using natural size.
    const effW = naturalWidth ?? nat?.w ?? 0;
    const effH = naturalHeight ?? nat?.h ?? 0;
    const looksNormalized = rawBoxes.length > 0 && effW > 0 && effH > 0 && rawBoxes.some(b => b.w > 0 && b.w <= 1.0 && b.h > 0 && b.h <= 1.0);

    return rawBoxes.map(b => {
      const bx = looksNormalized ? b.x * effW : b.x;
      const by = looksNormalized ? b.y * effH : b.y;
      const bw = looksNormalized ? b.w * effW : b.w;
      const bh = looksNormalized ? b.h * effH : b.h;
      const key = `${b.x},${b.y},${b.w},${b.h}`;
      const info = infosByKey.get(key);
      const boxFault = info?.boxFault ?? "none";
      const label = info?.label ?? boxFault;
  const comment = info?.comment ?? null;
  return { x: bx, y: by, w: bw, h: bh, boxFault, label, comment };
    });
  }, [boxes, boxInfo, naturalWidth, naturalHeight, nat?.w, nat?.h]);

  // Zoom/Pan state
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const lastPosRef = useRef<{x:number;y:number}|null>(null);
  const containerRef = useRef<HTMLDivElement|null>(null);
  const drawStartRef = useRef<{x:number;y:number}|null>(null);
  const [drawRect, setDrawRect] = useState<{x:number;y:number;w:number;h:number}|null>(null);
  const [containerSize, setContainerSize] = useState<{w:number;h:number}>({ w: 0, h: 0 });
  const PADDING = 10; // px per side
  const didInitialFitRef = useRef(false);
  const userInteractedRef = useRef(false);

  // Track container size with ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        setContainerSize({ w: cr.width, h: cr.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // If the container resizes before any user interaction, keep it centered/fitted.
  useEffect(() => {
    const { effW, effH } = getEffectiveImageSize();
    if (
      effW > 0 && effH > 0 && containerSize.w > 0 && containerSize.h > 0 &&
      didInitialFitRef.current && !userInteractedRef.current
    ) {
      fitToView();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerSize.w, containerSize.h]);

  const getEffectiveImageSize = () => {
    const effW = naturalWidth ?? nat?.w ?? 0;
    const effH = naturalHeight ?? nat?.h ?? 0;
    return { effW, effH };
  };

  const computeMinScale = (imgW: number, imgH: number, viewW: number, viewH: number) => {
    if (imgW <= 0 || imgH <= 0 || viewW <= 0 || viewH <= 0) return 1;
    const sx = (viewW - 2 * PADDING) / imgW;
    const sy = (viewH - 2 * PADDING) / imgH;
    // Ensure we cannot zoom out to show empty space on all 4 corners
    return Math.min(sx, sy);
  };

  const clampOffset = (newScale: number, o: {x:number;y:number}) => {
    const { effW, effH } = getEffectiveImageSize();
    const sw = effW * newScale;
    const sh = effH * newScale;
    const vw = containerSize.w;
    const vh = containerSize.h;

    let x = o.x;
    let y = o.y;

    // Horizontal constraints
    if (sw >= vw - 2 * PADDING) {
      const minX = vw - sw - PADDING;
      const maxX = PADDING;
      x = Math.min(maxX, Math.max(minX, x));
    } else {
      // Center horizontally if image is narrower than the view (with current scale)
      x = Math.round((vw - sw) / 2);
    }

    // Vertical constraints
    if (sh >= vh - 2 * PADDING) {
      const minY = vh - sh - PADDING;
      const maxY = PADDING;
      y = Math.min(maxY, Math.max(minY, y));
    } else {
      // Center vertically if image is shorter than the view (with current scale)
      y = Math.round((vh - sh) / 2);
    }

    return { x, y };
  };

  const fitToView = () => {
    const { effW, effH } = getEffectiveImageSize();
    const viewW = containerSize.w;
    const viewH = containerSize.h;
    const sx = (viewW - 2 * PADDING) / (effW || 1);
    const sy = (viewH - 2 * PADDING) / (effH || 1);
    const minS = Math.min(sx, sy);
    
    const sw = effW * minS;
    const sh = effH * minS;
    
    // center in both directions
    const x = Math.round((viewW - sw) / 2);
    const y = Math.round((viewH - sh) / 2);
    
    setScale(minS);
    setOffset({ x, y });
};


  const toStageCoords = (clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    // invert transform: (cx,cy) = translate(offset) + scale(stage)
    const sx = (cx - offset.x) / scale;
    const sy = (cy - offset.y) / scale;
    return { x: Math.max(0, sx), y: Math.max(0, sy) };
  };

  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    // Prevent page from scrolling while zooming over the image
    e.preventDefault();
    e.stopPropagation();
  userInteractedRef.current = true;
  const delta = -e.deltaY;
    const zoomFactor = Math.exp(delta * 0.0015); // smooth zoom
  const { effW, effH } = getEffectiveImageSize();
  const minS = computeMinScale(effW, effH, containerSize.w, containerSize.h);
  const newScale = Math.min(8, Math.max(minS, scale * zoomFactor));

    // Zoom relative to cursor position
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const sx = cx - (cx - offset.x) * (newScale / scale);
      const sy = cy - (cy - offset.y) * (newScale / scale);
      const clamped = clampOffset(newScale, { x: sx, y: sy });
      setOffset(clamped);
    }
    setScale(newScale);
  };

  const onMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    // Ignore mousedown originating from interactive children like the X button
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'BUTTON' || target.closest('button'))) {
      return;
    }
    if (allowDraw) {
      const s = toStageCoords(e.clientX, e.clientY);
      drawStartRef.current = s;
      setDrawRect({ x: s.x, y: s.y, w: 0, h: 0 });
      isPanningRef.current = false;
      lastPosRef.current = null;
    } else {
      userInteractedRef.current = true;
      isPanningRef.current = true;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
    }
  };
  const onMouseUp: React.MouseEventHandler<HTMLDivElement> = () => {
    if (drawStartRef.current && drawRect && allowDraw) {
      // finalize draw
      const rect = drawRect;
      setDrawRect(null);
      drawStartRef.current = null;
      if (rect.w > 4 && rect.h > 4) {
        if (onDrawComplete) {
          onDrawComplete({ x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h) });
        }
      }
      return;
    }
    isPanningRef.current = false;
    lastPosRef.current = null;
  };
  const onMouseLeave: React.MouseEventHandler<HTMLDivElement> = onMouseUp;
  const onMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (drawStartRef.current && allowDraw) {
      const s = drawStartRef.current;
      const p = toStageCoords(e.clientX, e.clientY);
      const x = Math.min(s.x, p.x);
      const y = Math.min(s.y, p.y);
      const w = Math.abs(p.x - s.x);
      const h = Math.abs(p.y - s.y);
      setDrawRect({ x, y, w, h });
      return;
    }
    if (!isPanningRef.current || !lastPosRef.current) return;
    const dx = e.clientX - lastPosRef.current.x;
    const dy = e.clientY - lastPosRef.current.y;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    setOffset((o) => clampOffset(scale, { x: o.x + dx, y: o.y + dy }));
  };

  useEffect(() => {
    // Attach a native wheel listener with passive: false to ensure preventDefault works
    const el = containerRef.current;
    if (!el) return;
    const handler = (evt: WheelEvent) => {
      // Always prevent default scroll when mouse wheel is over the interactive image area
      // Do not stop propagation here so React's onWheel zoom logic still runs.
      evt.preventDefault();
    };
    el.addEventListener('wheel', handler, { passive: false, capture: true });
    return () => {
      el.removeEventListener('wheel', handler, { capture: true });
    };
  }, []);

  useEffect(() => {
    // Reset zoom/pan when imageUrl changes
    setNat(null);
    // We'll fit to view once we know image size and container size
    didInitialFitRef.current = false;
    userInteractedRef.current = false;
  }, [imageUrl]);

  useEffect(() => {
    if (resetKey === undefined) return;
    // Force a new initial fit cycle on resetKey changes
    didInitialFitRef.current = false;
    userInteractedRef.current = false;
    const { effW, effH } = getEffectiveImageSize();
    if (effW > 0 && effH > 0 && containerSize.w > 0 && containerSize.h > 0) {
      fitToView();
      didInitialFitRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Fit to view when container or natural image size is ready
  useEffect(() => {
    if (!imageUrl) return;
    const { effW, effH } = getEffectiveImageSize();
    if (!didInitialFitRef.current && effW > 0 && effH > 0 && containerSize.w > 0 && containerSize.h > 0) {
      // Fit once when both sizes are known to center image initially
      fitToView();
      didInitialFitRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nat, naturalWidth, naturalHeight, containerSize.w, containerSize.h, imageUrl]);

  // Fallback: if still at initial state (scale=1, offset=0) but sizes are ready, center now.
  useEffect(() => {
    const { effW, effH } = getEffectiveImageSize();
    if (
      imageUrl &&
      effW > 0 && effH > 0 && containerSize.w > 0 && containerSize.h > 0 &&
      scale === 1 && offset.x === 0 && offset.y === 0
    ) {
      requestAnimationFrame(() => {
        if (scale === 1 && offset.x === 0 && offset.y === 0) {
          fitToView();
          didInitialFitRef.current = true;
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl, nat, naturalWidth, naturalHeight, containerSize.w, containerSize.h, scale, offset.x, offset.y]);

  // Handle cached images: if the image is already complete at mount/change, set natural size and center.
  useLayoutEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    if (img.complete) {
      if (!naturalWidth || !naturalHeight) {
        if (!nat || nat.w !== img.naturalWidth || nat.h !== img.naturalHeight) {
          setNat({ w: img.naturalWidth, h: img.naturalHeight });
        }
      }
      if (!didInitialFitRef.current) {
        requestAnimationFrame(() => {
          const { effW, effH } = getEffectiveImageSize();
          if (effW > 0 && effH > 0 && containerSize.w > 0 && containerSize.h > 0) {
            fitToView();
            didInitialFitRef.current = true;
          }
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  const onResetView = () => {
    fitToView();
  };

  return (
    <div
      ref={containerRef}
      className={`${containerClassName ?? ""} bg-white dark:bg-[#111]`}
      style={{ position: "relative", width: "100%", height: "28rem", overflow: "hidden", cursor: isPanningRef.current ? "grabbing" : "grab", overscrollBehavior: "contain" }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
    >
      {(() => {
        const effW = naturalWidth ?? nat?.w ?? 0;
        const effH = naturalHeight ?? nat?.h ?? 0;
        // Wait for image dimensions before rendering stage
        return (
          <>
            {/* Reset zoom control */}
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onResetView(); }}
              style={{ position: 'absolute', right: 8, top: 8, zIndex: 5, background: '#000', color: '#fff', padding: '6px 10px', borderRadius: 6, opacity: 0.85 }}
              title="Reset zoom"
            >
              Reset
            </button>
            <img
              ref={imgRef}
              onLoad={(e) => {
                const el = e.currentTarget;
                if (!naturalWidth || !naturalHeight) {
                  console.log('Image loaded, setting natural dimensions:', el.naturalWidth, 'x', el.naturalHeight);
                  setNat({ w: el.naturalWidth, h: el.naturalHeight });
                }
                // After the image loads, if we haven't performed the initial fit, do it now on the next frame
                if (!didInitialFitRef.current) {
                  requestAnimationFrame(() => {
                    const { effW, effH } = getEffectiveImageSize();
                    if (effW > 0 && effH > 0 && containerSize.w > 0 && containerSize.h > 0) {
                      fitToView();
                      didInitialFitRef.current = true;
                    }
                  });
                }
              }}
              src={imageUrl}
              alt="Thermal"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                transformOrigin: "top left",
                width: effW ? `${effW}px` : undefined,
                height: effH ? `${effH}px` : undefined,
                display: "block",
                userSelect: "none",
                // Keep the image itself non-interactive; overlay will handle interactions
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
            {/* Overlay layer, same sized stage as image - only render when we have dimensions */}
            {effW > 0 && effH > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: `${effW}px`,
                  height: `${effH}px`,
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                  transformOrigin: "top left",
                  // Allow interaction with overlay (for remove buttons)
                  pointerEvents: "auto",
                  zIndex: 2,
                }}
              >
                {drawRect && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${drawRect.x}px`,
                      top: `${drawRect.y}px`,
                      width: `${drawRect.w}px`,
                      height: `${drawRect.h}px`,
                      border: '2px dashed #2563eb',
                      background: 'rgba(37,99,235,0.1)',
                      boxSizing: 'border-box',
                      pointerEvents: 'none',
                      zIndex: 3,
                    }}
                  />
                )}
                {list.map((b, idx) => {
          // Normalize the boxFault value to handle case sensitivity and trim whitespace
          const normalizedFault = (b.boxFault || "").toLowerCase().trim();
          
          // Check if this box should be shown based on its fault type and the toggles
          let show = false;
          if (normalizedFault === "loose joint") {
            show = toggles.looseJoint;
          } else if (normalizedFault === "point overload") {
            show = toggles.pointOverload;
          } else if (normalizedFault === "wire overload") {
            show = toggles.wireOverload;
          } else if (normalizedFault === "none" || normalizedFault === "") {
            // Show "none" faults if any toggle is enabled (fallback for unclassified faults)
            show = toggles.looseJoint || toggles.pointOverload || toggles.wireOverload;
          } else {
            // Default for unknown fault types: show if any toggle is on.
            show = toggles.looseJoint || toggles.pointOverload || toggles.wireOverload;
          }
          
          // debug trace removed for production

          if (!show) return null;
                  return (
                    <div key={`${b.x}-${b.y}-${idx}`}
                      style={{
                        position: "absolute",
                        left: `${b.x}px`,
                        top: `${b.y}px`,
                        width: `${b.w}px`,
                        height: `${b.h}px`,
                        border: "2px solid red",
                        boxSizing: "border-box",
                        cursor: onRemoveBox || onSelectBox ? 'pointer' : 'default',
                      }}
                      onClick={() => {
                        if (onSelectBox) {
                          onSelectBox(idx, { x: b.x, y: b.y, w: b.w, h: b.h });
                        }
                      }}
                    >
              <div
                style={{
                  position: "absolute",
                  right: 2,
                  top: 2,
                  background: "red",
                  color: "white",
                  fontSize: 12,
                  padding: "2px 4px",
                  borderRadius: 2,
                }}
              >
                {b.label || b.boxFault || "fault"}
              </div>
              {b.comment && b.comment.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    left: 2,
                    bottom: 2,
                    maxWidth: '90%',
                    background: 'rgba(17,24,39,0.85)',
                    color: '#f9fafb',
                    fontSize: 11,
                    padding: '2px 4px',
                    borderRadius: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={b.comment}
                >
                  {b.comment}
                </div>
              )}
              {onSelectBox && (
                <button
                  type="button"
                  title="Edit box"
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSelectBox(idx, { x: b.x, y: b.y, w: b.w, h: b.h }); }}
                  style={{
                    position: 'absolute',
                    top: -8,
                    left: -8,
                    minWidth: 36,
                    height: 20,
                    borderRadius: 10,
                    background: '#1f2937',
                    color: '#fff',
                    fontSize: 10,
                    lineHeight: '20px',
                    textAlign: 'center',
                    padding: '0 6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                  }}
                >
                  Edit
                </button>
              )}
              {/* Hover X button to remove */}
              {onRemoveBox && (
                <button
                  type="button"
                  title="Remove box"
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemoveBox(idx, { x: b.x, y: b.y, w: b.w, h: b.h }); }}
                  style={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#000',
                    color: '#fff',
                    lineHeight: '20px',
                    fontSize: 12,
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                  }}
                >
                  ×
                </button>
              )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
};

export default OverlayedThermal;
