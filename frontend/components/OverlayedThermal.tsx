"use client";

import React, { useMemo } from "react";

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
  naturalWidth?: number;
  naturalHeight?: number;
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
      return { ...b, boxFault: info?.boxFault ?? "none", label: info?.label };
    });
  }, [boxes, boxInfo]);

  const containerStyle: React.CSSProperties = {
    position: "relative",
    width: "100%",
  };

  const imgStyle: React.CSSProperties = {
    width: "100%",
    height: "auto",
    display: "block",
  };

  return (
    <div className={containerClassName} style={containerStyle}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="Thermal" style={imgStyle} />
      {/* Overlay layer */}
      <div style={{ position: "absolute", inset: 0 }}>
        {list.map((b, idx) => {
          const allOn = toggles.looseJoint && toggles.pointOverload && toggles.wireOverload;
          const show = allOn || (
            (b.boxFault === "loose joint" && toggles.looseJoint) ||
            (b.boxFault === "point overload" && toggles.pointOverload) ||
            (b.boxFault === "wire overload" && toggles.wireOverload)
          );
          if (!show) return null;
          return (
            <div key={`${b.x}-${b.y}-${idx}`}
              style={{
                position: "absolute",
                left: `${(b.x / (naturalWidth || 1)) * 100}%`,
                top: `${(b.y / (naturalHeight || 1)) * 100}%`,
                width: `${(b.w / (naturalWidth || 1)) * 100}%`,
                height: `${(b.h / (naturalHeight || 1)) * 100}%`,
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
                {b.boxFault}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OverlayedThermal;
