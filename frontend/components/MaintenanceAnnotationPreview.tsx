"use client";

import { useMemo } from "react";
import OverlayedThermal, {
  OverlayBoxInfo,
  OverlayToggles,
} from "@/components/OverlayedThermal";
import {
  canonicalizeFault,
  toDisplayLabel,
} from "@/lib/inspection-annotations";

const TOGGLES_ALWAYS_ON: OverlayToggles = {
  looseJoint: true,
  pointOverload: true,
  wireOverload: true,
};

const formatSeverityLabel = (value?: number | null): string | null => {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  const pct = value > 1 ? Math.round(value) : Math.round(value * 100);
  if (!Number.isFinite(pct)) return null;
  return `Severity ${pct}%`;
};

interface MaintenanceAnnotationPreviewProps {
  title?: string;
  subtitle?: string;
  imageUrl?: string | null;
  boxes?: number[][] | null | undefined;
  faults?: string[] | null | undefined;
  annotatedBy?: (string | null | undefined)[] | null;
  severity?: (number | null | undefined)[] | null;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  className?: string;
  resetKey?: string | number;
}

const MaintenanceAnnotationPreview = ({
  title = "Latest annotations",
  subtitle,
  imageUrl,
  boxes,
  faults,
  annotatedBy,
  severity,
  loading = false,
  error = null,
  emptyMessage = "No annotations available for this inspection.",
  className = "",
  resetKey,
}: MaintenanceAnnotationPreviewProps) => {
  const normalizedBoxes = useMemo(() => {
    if (!Array.isArray(boxes)) return [];
    return boxes
      .map((box) => {
        if (!Array.isArray(box) || box.length < 4) return null;
        const x = Number(box[0]);
        const y = Number(box[1]);
        const w = Number(box[2]);
        const h = Number(box[3]);
        if (
          Number.isNaN(x) ||
          Number.isNaN(y) ||
          Number.isNaN(w) ||
          Number.isNaN(h) ||
          w <= 0 ||
          h <= 0
        ) {
          return null;
        }
        return [x, y, w, h];
      })
      .filter((box): box is number[] => box !== null);
  }, [boxes]);

  const legendEntries = useMemo(
    () =>
      normalizedBoxes.map((box, index) => {
        const faultKey = canonicalizeFault(faults?.[index] ?? "none");
        const label = toDisplayLabel(faultKey);
        const annotatorRaw = annotatedBy?.[index];
        const annotator =
          typeof annotatorRaw === "string" && annotatorRaw.trim().length > 0
            ? annotatorRaw.trim()
            : "user";
        const severityValue = severity?.[index];
        return {
          key: `legend-${index}-${box[0]}-${box[1]}-${box[2]}-${box[3]}`,
          label,
          faultKey,
          annotator,
          severityLabel: formatSeverityLabel(
            typeof severityValue === "number" ? severityValue : null
          ),
        };
      }),
    [annotatedBy, faults, normalizedBoxes, severity]
  );

  const overlayInfo: OverlayBoxInfo[] = useMemo(
    () =>
      normalizedBoxes.map((box, index) => ({
        x: box[0],
        y: box[1],
        w: box[2],
        h: box[3],
        boxFault: legendEntries[index]?.faultKey ?? "none",
        label: String(index + 1),
      })),
    [legendEntries, normalizedBoxes]
  );

  const hasImage = typeof imageUrl === "string" && imageUrl.length > 0;
  const hasAnnotations = normalizedBoxes.length > 0;

  let body: React.ReactNode = null;
  if (loading) {
    body = (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Loading annotation preview…
      </p>
    );
  } else if (error) {
    body = (
      <p className="text-sm text-red-600" role="alert">
        {error}
      </p>
    );
  } else if (!hasImage) {
    body = (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {emptyMessage}
      </p>
    );
  } else if (!hasAnnotations) {
    body = (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {emptyMessage}
      </p>
    );
  } else {
    body = (
      <>
        <div className="mt-3">
          <OverlayedThermal
            imageUrl={imageUrl}
            boxes={normalizedBoxes}
            boxInfo={overlayInfo}
            toggles={TOGGLES_ALWAYS_ON}
            containerClassName="w-full h-64 border border-gray-200 dark:border-gray-700 rounded overflow-hidden"
            resetKey={resetKey}
          />
        </div>
        <ol className="mt-3 space-y-2 text-xs text-gray-700 dark:text-gray-300">
          {legendEntries.map((entry, index) => (
            <li key={entry.key} className="flex gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-white text-[11px] font-semibold dark:bg-gray-100 dark:text-black">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {entry.label}
                  {` · Annotated by ${entry.annotator}`}
                  {entry.severityLabel ? ` · ${entry.severityLabel}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </>
    );
  }

  return (
    <div className={`details-panel border border-gray-200 dark:border-gray-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
          )}
        </div>
        {hasAnnotations && !loading && !error && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {legendEntries.length} {legendEntries.length === 1 ? "annotation" : "annotations"}
          </span>
        )}
      </div>
      {body}
    </div>
  );
};

export default MaintenanceAnnotationPreview;
