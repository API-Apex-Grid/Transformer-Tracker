"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";

export type OverlayBoxInfo = {
  x: number; y: number; w: number; h: number;
  label?: string;
  boxFault?: "loose joint" | "point overload" | "wire overload" | "none" | string;
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
    return rawBoxes.map(b => {
      const key = `${b.x},${b.y},${b.w},${b.h}`;
      const info = infosByKey.get(key);
      const boxFault = info?.boxFault ?? "none";
      const label = info?.label ?? boxFault;
      return { ...b, boxFault, label };
    });
  }, [boxes, boxInfo]);

  // Zoom/Pan state
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const lastPosRef = useRef<{x:number;y:number}|null>(null);
  const containerRef = useRef<HTMLDivElement|null>(null);

  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    const delta = -e.deltaY;
    const zoomFactor = Math.exp(delta * 0.0015); // smooth zoom
    const newScale = Math.min(8, Math.max(0.25, scale * zoomFactor));

    // Zoom relative to cursor position
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const sx = cx - (cx - offset.x) * (newScale / scale);
      const sy = cy - (cy - offset.y) * (newScale / scale);
      setOffset({ x: sx, y: sy });
    }
    setScale(newScale);
  };

  const onMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    isPanningRef.current = true;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseUp: React.MouseEventHandler<HTMLDivElement> = () => {
    isPanningRef.current = false;
    lastPosRef.current = null;
  };
  const onMouseLeave: React.MouseEventHandler<HTMLDivElement> = onMouseUp;
  const onMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!isPanningRef.current || !lastPosRef.current) return;
    const dx = e.clientX - lastPosRef.current.x;
    const dy = e.clientY - lastPosRef.current.y;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  };

  useEffect(() => {
    // Reset zoom/pan when imageUrl changes
    setScale(1);
    setOffset({ x: 0, y: 0 });
    // Reset natural size; will be set on image load
    setNat(null);
  }, [imageUrl]);

  return (
    <div
      ref={containerRef}
      className={containerClassName}
      style={{ position: "relative", width: "100%", height: "28rem", overflow: "hidden", cursor: isPanningRef.current ? "grabbing" : "grab" }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        onLoad={(e) => {
          const el = e.currentTarget;
          // Use the image's intrinsic size if not explicitly provided
          if (!naturalWidth || !naturalHeight) {
            setNat({ w: el.naturalWidth, h: el.naturalHeight });
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
          width: "100%",
          height: "auto",
          display: "block",
          userSelect: "none",
          pointerEvents: "none",
        }}
      />
      {/* Overlay layer */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
      >
        {list.map((b, idx) => {
          // Normalize the boxFault value to handle case sensitivity and trim whitespace
          console.log("Box fault from data:", b.boxFault);
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
          
          if (!show) return null;
          const effW = naturalWidth ?? nat?.w ?? 1;
          const effH = naturalHeight ?? nat?.h ?? 1;
          return (
            <div key={`${b.x}-${b.y}-${idx}`}
              style={{
                position: "absolute",
                left: `${(b.x / effW) * 100}%`,
                top: `${(b.y / effH) * 100}%`,
                width: `${(b.w / effW) * 100}%`,
                height: `${(b.h / effH) * 100}%`,
                border: "2px solid red",
                boxSizing: "border-box",
              }}>
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
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OverlayedThermal;
