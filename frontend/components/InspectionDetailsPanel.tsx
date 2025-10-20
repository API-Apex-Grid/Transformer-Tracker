"use client";

import { Inspection } from "@/types/inspection";
import { Transformer } from "@/types/transformer";
import ThermalImage from "@/components/ThermalImage";
import OverlayedThermal, {
  OverlayToggles,
  OverlayBoxInfo,
} from "@/components/OverlayedThermal";
import { useTransformers } from "@/context/TransformersContext";
import { useInspections } from "@/context/InspectionsContext";
import { useState, useMemo, useEffect, useRef } from "react";
import { apiUrl } from "@/lib/api";
import LoadingScreen from "@/components/LoadingScreen";

const toFinite = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const canonicalizeFault = (fault: string | null | undefined): string => {
  if (!fault) return "none";
  const normalized = fault
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\-_]+/g, " ");
  if (!normalized) return "none";
  if (normalized.includes("loose") && normalized.includes("joint"))
    return "loose joint";
  if (normalized.includes("wire") && normalized.includes("overload"))
    return "wire overload";
  if (normalized.includes("point") && normalized.includes("overload"))
    return "point overload";
  if (normalized === "none" || normalized === "ok" || normalized === "normal")
    return "none";
  return normalized;
};

const toDisplayLabel = (fault: string): string => {
  if (!fault || fault === "none") return "No classification";
  return fault
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const faultToToggleKey = (
  fault: string | null | undefined
): keyof OverlayToggles | null => {
  const normalized = canonicalizeFault(fault);
  switch (normalized) {
    case "loose joint":
      return "looseJoint";
    case "point overload":
      return "pointOverload";
    case "wire overload":
      return "wireOverload";
    default:
      return null;
  }
};

const parseBoundingBoxes = (raw: Inspection["boundingBoxes"]): number[][] => {
  let source: unknown = raw;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(source)) return [];
  if (source.length === 0) return [];

  const boxes: number[][] = [];
  const maybePush = (
    x: number | null,
    y: number | null,
    w: number | null,
    h: number | null
  ) => {
    if (x === null || y === null || w === null || h === null) return;
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
    boxes.push([x, y, w, h]);
  };

  const arraySource = source as unknown[];
  if (
    typeof arraySource[0] === "number" ||
    typeof arraySource[0] === "string"
  ) {
    const flat = arraySource as Array<number | string>;
    for (let i = 0; i + 3 < flat.length; i += 4) {
      maybePush(
        toFinite(flat[i]),
        toFinite(flat[i + 1]),
        toFinite(flat[i + 2]),
        toFinite(flat[i + 3])
      );
    }
    return boxes;
  }

  for (const entry of arraySource) {
    if (Array.isArray(entry)) {
      maybePush(
        toFinite(entry[0]),
        toFinite(entry[1]),
        toFinite(entry[2]),
        toFinite(entry[3])
      );
      continue;
    }
    if (entry && typeof entry === "object") {
      const obj = entry as Record<string, unknown>;
      const x = toFinite(obj.x ?? obj.left ?? obj.startX ?? obj[0]);
      const y = toFinite(obj.y ?? obj.top ?? obj.startY ?? obj[1]);
      let w = toFinite(obj.w ?? obj.width ?? obj[2]);
      let h = toFinite(obj.h ?? obj.height ?? obj[3]);
      if ((w === null || h === null) && x !== null && y !== null) {
        const x2 = toFinite(obj.x2 ?? obj.right ?? obj.endX);
        const y2 = toFinite(obj.y2 ?? obj.bottom ?? obj.endY);
        if (w === null && x2 !== null) w = x2 - x;
        if (h === null && y2 !== null) h = y2 - y;
      }
      maybePush(x, y, w, h);
    }
  }

  return boxes;
};

const parseFaultTypes = (
  raw: Inspection["faultTypes"],
  expectedLength: number
): string[] => {
  let source: unknown = raw;
  if (typeof source === "string") {
    const original = source;
    try {
      const parsed = JSON.parse(original);
      source = parsed;
    } catch {
      source = original
        .split(/[,;\n]+/)
        .map((part: string) => part.trim())
        .filter((part) => part.length > 0);
    }
  }
  const arr: string[] = Array.isArray(source)
    ? (source as unknown[]).map((item) =>
        typeof item === "string" ? item : item != null ? String(item) : ""
      )
    : typeof source === "string"
    ? [source]
    : [];

  const normalized = arr.map((fault) => canonicalizeFault(fault));
  if (normalized.length < expectedLength) {
    normalized.push(
      ...Array.from(
        { length: expectedLength - normalized.length },
        () => "none"
      )
    );
  }
  return normalized.slice(0, expectedLength);
};

const parseAnnotatedBy = (
  raw: string | string[] | null | undefined,
  expectedLength: number
): string[] => {
  if (!raw) return Array(expectedLength).fill("user");
  let source: unknown = raw;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      return Array(expectedLength).fill("user");
    }
  }
  if (!Array.isArray(source)) return Array(expectedLength).fill("user");
  const arr = source.map((item) =>
    typeof item === "string" ? item : "user"
  );
  if (arr.length < expectedLength) {
    arr.push(...Array(expectedLength - arr.length).fill("user"));
  }
  return arr.slice(0, expectedLength);
};

const parseSeverities = (
  raw: Inspection["severity"],
  expectedLength: number
): (number | null)[] => {
  if (raw == null) return Array(expectedLength).fill(null);
  let source: unknown = raw;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      source = (source as string)
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const n = Number.parseFloat(s);
          return Number.isFinite(n) ? n : null;
        });
    }
  }
  if (!Array.isArray(source)) return Array(expectedLength).fill(null);
  const arr = (source as unknown[]).map((v) => {
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v === "string") {
      const n = Number.parseFloat(v);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  });
  if (arr.length < expectedLength) {
    arr.push(...Array(expectedLength - arr.length).fill(null));
  }
  return arr.slice(0, expectedLength);
};

const parseComments = (
  raw: Inspection["comment"],
  expectedLength: number
): (string | null)[] => {
  if (raw == null) return Array(expectedLength).fill(null);
  let source: unknown = raw;
  if (typeof source === "string") {
    const original = source;
    try {
      const parsed = JSON.parse(original);
      source = parsed;
    } catch {
      const trimmed = original.trim();
      if (!trimmed) return Array(expectedLength).fill(null);
      source = trimmed.split(/\r?\n+/).map((item) => item.trim());
    }
  }
  const arr: (string | null)[] = Array.isArray(source)
    ? (source as unknown[]).map((item) => {
        if (item == null) return null;
        const str = typeof item === "string" ? item : String(item);
        const trimmed = str.trim();
        return trimmed.length > 0 ? trimmed : null;
      })
    : typeof source === "string"
    ? [source.trim()].map((s) => (s.length > 0 ? s : null))
    : [];
  if (arr.length < expectedLength) {
    arr.push(...Array(expectedLength - arr.length).fill(null));
  }
  return arr.slice(0, expectedLength);
};

const normalizeStatus = (value: unknown): "added" | "edited" | "deleted" | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "added" || normalized === "edited" || normalized === "deleted") {
    return normalized;
  }
  return null;
};

const parseStatuses = (
  raw: string | string[] | null | undefined,
  expectedLength: number
): ("added" | "edited" | "deleted" | null)[] => {
  if (expectedLength <= 0) return [];
  let source: unknown = raw;
  if (typeof source === "string") {
    const trimmed = source.trim();
    if (!trimmed) {
      source = [];
    } else {
      try {
        source = JSON.parse(trimmed);
      } catch {
        source = trimmed
          .split(/[,;\n]+/)
          .map((part) => part.trim())
          .filter((part) => part.length > 0);
      }
    }
  }
  const arr: ("added" | "edited" | "deleted" | null)[] = Array.isArray(source)
    ? (source as unknown[]).map((item) => normalizeStatus(item))
    : [];
  while (arr.length < expectedLength) {
    arr.push(null);
  }
  if (arr.length > expectedLength) {
    arr.length = expectedLength;
  }
  return arr;
};

const parseCreatedAt = (
  raw: Inspection["boxCreatedAt"] | unknown,
  expectedLength: number
): (string | null)[] => {
  if (expectedLength <= 0) return [];
  let source: unknown = raw ?? null;
  if (typeof source === "string") {
    const trimmed = source.trim();
    if (!trimmed) {
      source = [];
    } else {
      try {
        source = JSON.parse(trimmed);
      } catch {
        source = [trimmed];
      }
    }
  }
  const arr: (string | null)[] = Array.isArray(source)
    ? (source as unknown[]).map((item) => {
        if (item == null) return null;
        const text = typeof item === "string" ? item : String(item);
        const trimmed = text.trim();
        return trimmed.length > 0 ? trimmed : null;
      })
    : typeof source === "string"
    ? [source]
    : [];
  while (arr.length < expectedLength) arr.push(null);
  if (arr.length > expectedLength) arr.length = expectedLength;
  return arr;
};

const formatStatusLabel = (
  status: string | null | undefined,
  isSnapshot: boolean
): string | null => {
  switch (status) {
    case "added":
      return "Status: added";
    case "edited":
      return "Status: edited";
    case "deleted":
      return isSnapshot ? "Status: deleted (removed after this snapshot)" : null;
    default:
      return null;
  }
};

const formatCreatedAtLabel = (
  value: string | null | undefined
): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const buildBoxInfo = (
  boxes: number[][],
  faults: string[],
  comments?: (string | null)[],
  statuses?: ("added" | "edited" | "deleted" | null)[],
  createdAt?: (string | null)[]
): OverlayBoxInfo[] =>
  boxes.map((box, index) => {
    const fault = faults[index] ?? "none";
    return {
      x: box[0],
      y: box[1],
      w: box[2],
      h: box[3],
      boxFault: fault,
      label: toDisplayLabel(fault),
      comment: comments ? comments[index] ?? null : null,
      status: statuses ? statuses[index] ?? null : null,
      createdAt: createdAt ? createdAt[index] ?? null : null,
    };
  });

const parseHistoryEntries = (raw: unknown): unknown[] => {
  if (raw == null) return [];
  let source: unknown = raw;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      return [];
    }
  }
  return Array.isArray(source) ? (source as unknown[]) : [];
};

type HistorySnapshot = {
  boxes: number[][];
  faults: string[];
  annotatedBy: string[];
  severity: (number | null)[];
  comments: (string | null)[];
  statuses: ("added" | "edited" | "deleted" | null)[];
  createdAt: (string | null)[];
  timestamp: string | null;
};

const formatTimestamp = (timestamp: string | null | undefined): string => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString();
};

const summarizeAnnotators = (annotatedBy: string[]): string | null => {
  const cleaned = annotatedBy
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  if (cleaned.length === 0) return null;
  const normalized = cleaned.map((val) => val.toLowerCase());
  const unique = Array.from(new Set(normalized));
  if (unique.length === 1) {
    const original = cleaned.find((val) => val.toLowerCase() === unique[0]) ?? cleaned[0];
    if (unique[0] === "ai") return "AI";
    return original;
  }
  return "multiple annotators";
};

const buildSnapshotLabel = (snapshot: HistorySnapshot, index: number, total: number): string => {
  const ordinal = total - index;
  const ts = formatTimestamp(snapshot.timestamp);
  const actor = summarizeAnnotators(snapshot.annotatedBy);
  let label = `Snapshot ${ordinal}`;
  if (ts) label += ` · ${ts}`;
  if (actor) label += ` · ${actor}`;
  return label;
};

const cloneBoxes = (boxes: number[][]): number[][] =>
  boxes.map((box) => box.slice() as number[]);

const cloneStrings = (values: string[]): string[] => values.slice();

const cloneSeverities = (values: (number | null)[]): (number | null)[] =>
  values.slice();

const cloneComments = (values: (string | null)[]): (string | null)[] =>
  values.slice();

const cloneStatuses = (
  values: ("added" | "edited" | "deleted" | null)[]
): ("added" | "edited" | "deleted" | null)[] => values.slice();

const cloneTimestamps = (values: (string | null)[]): (string | null)[] =>
  values.slice();

const jsonEqual = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

interface InspectionDetailsPanelProps {
  inspection: Inspection;
  onClose: () => void;
}

const InspectionDetailsPanel = ({
  inspection,
  onClose,
}: InspectionDetailsPanelProps) => {
  const { transformers, reload: reloadTransformers } = useTransformers();
  const { reload } = useInspections();
  const [selectedWeather, setSelectedWeather] = useState<string>(
    // Prefer last analysis weather when present, else current inspection weather, else sunny
    (inspection.lastAnalysisWeather as string) || inspection.weather || "sunny"
  );
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(
    inspection.imageUrl || null
  );
  const [uploadedAt, setUploadedAt] = useState<string | null>(
    inspection.imageUploadedAt || null
  );
  const [uploadedBy, setUploadedBy] = useState<string | null>(
    inspection.imageUploadedBy || null
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [baselinePreviewUrl, setBaselinePreviewUrl] = useState<string | null>(
    null
  );
  const [aiStats, setAiStats] = useState<{
    prob?: number;
    histDistance?: number;
    dv95?: number;
    warmFraction?: number;
    boxes?: number[][] | number[];
    boxInfo?: (OverlayBoxInfo & {
      severity?: number;
      severityLabel?: string;
      avgDeltaV?: number;
      maxDeltaV?: number;
    })[];
    // dimensions omitted; overlay infers them from the image element
    imageWidth?: number;
    imageHeight?: number;
    overallSeverity?: number;
    overallSeverityLabel?: string;
  } | null>(null);
  const [overlayToggles, setOverlayToggles] = useState<OverlayToggles>({
    looseJoint: true,
    pointOverload: true,
    wireOverload: true,
  });
  // Local states for stored analysis so we can update immediately after delete
  const [storedBoxes, setStoredBoxes] = useState<number[][]>([]);
  const [storedFaultTypes, setStoredFaultTypes] = useState<string[]>([]);
  const [storedAnnotatedBy, setStoredAnnotatedBy] = useState<string[]>([]);
  const [storedSeverity, setStoredSeverity] = useState<(number | null)[]>([]);
  const [storedComments, setStoredComments] = useState<(string | null)[]>([]);
  const [storedCreatedAt, setStoredCreatedAt] = useState<(string | null)[]>([]);
  const [storedStatuses, setStoredStatuses] = useState<("added" | "edited" | "deleted" | null)[]>([]);
  const initialStoredRef = useRef<{
    boxes: number[][];
    faults: string[];
    annotatedBy: string[];
    severity: (number | null)[];
    comments: (string | null)[];
    createdAt: (string | null)[];
    statuses: ("added" | "edited" | "deleted" | null)[];
  }>({ boxes: [], faults: [], annotatedBy: [], severity: [], comments: [], createdAt: [], statuses: [] });
  const [tuneModelEnabled, setTuneModelEnabled] = useState(true);
  const [historySnapshots, setHistorySnapshots] = useState<HistorySnapshot[]>([]);
  const [selectedSnapshotIndex, setSelectedSnapshotIndex] = useState<number | null>(null);
  // Queue changes to persist on close (X)
  const [pendingAdds, setPendingAdds] = useState<
    { x: number; y: number; w: number; h: number; faultType: string; comment?: string | null }[]
  >([]);
  const [pendingDeletes, setPendingDeletes] = useState<
    { x: number; y: number; w: number; h: number }[]
  >([]);
  const [isClosing, setIsClosing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const sameBox = (a: {x:number;y:number;w:number;h:number}, b: {x:number;y:number;w:number;h:number}) =>
    a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
  const rectsEqual = (
    a: { x: number; y: number; w: number; h: number } | null,
    b: { x: number; y: number; w: number; h: number } | null,
    tolerance = 0.5
  ): boolean => {
    if (!a || !b) return false;
    return (
      Math.abs(a.x - b.x) <= tolerance &&
      Math.abs(a.y - b.y) <= tolerance &&
      Math.abs(a.w - b.w) <= tolerance &&
      Math.abs(a.h - b.h) <= tolerance
    );
  };
  // Drawing & modal state
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [drawTarget, setDrawTarget] = useState<"ai" | "stored" | "ai-edit" | "stored-edit" | null>(null);
  const [pendingRect, setPendingRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [showFaultModal, setShowFaultModal] = useState(false);
  const [faultSelection, setFaultSelection] = useState<string>("loose joint");
  const [commentInput, setCommentInput] = useState<string>("");
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editSource, setEditSource] = useState<"ai" | "stored" | null>(null);
  const [editSelectionMode, setEditSelectionMode] = useState<"ai" | "stored" | null>(null);
  const [editOriginalRect, setEditOriginalRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [awaitingRedraw, setAwaitingRedraw] = useState(false);
  const [showResetModelConfirm, setShowResetModelConfirm] = useState(false);
  const [isResettingModel, setIsResettingModel] = useState(false);
  const [resetModelMessage, setResetModelMessage] = useState<string | null>(null);
  const [resetModelError, setResetModelError] = useState<string | null>(null);

  const transformer = useMemo(
    () =>
      transformers.find(
        (t) => t.transformerNumber === inspection.transformerNumber
      ),
    [transformers, inspection.transformerNumber]
  );
  const nestedTransformer: Transformer | undefined = useMemo(() => {
    const anyObj = inspection as unknown as { transformer?: Transformer };
    return anyObj.transformer;
  }, [inspection]);

  const effectiveUploadedUrl = useMemo(() => {
    return uploadedUrl ?? (inspection.imageUrl || null);
  }, [uploadedUrl, inspection.imageUrl]);

  const storedImageUrl = useMemo(() => {
    return inspection.imageUrl || uploadedUrl || previewUrl || null;
  }, [inspection.imageUrl, uploadedUrl, previewUrl]);

  const baselineForWeather = (weather?: string | null) => {
    const source =
      transformer &&
      (transformer.sunnyImage ||
        transformer.cloudyImage ||
        transformer.windyImage)
        ? transformer
        : (nestedTransformer as Transformer | undefined);
    if (!source) return null;
    switch (weather) {
      case "sunny":
        return source.sunnyImage || null;
      case "cloudy":
        return source.cloudyImage || null;
      case "rainy":
        // Map rainy to windy baseline if rainy is not modeled; adjust if needed
        return source.windyImage || null;
      default:
        return (
          source.sunnyImage || source.cloudyImage || source.windyImage || null
        );
    }
  };

  const displaySnapshot =
    selectedSnapshotIndex === null
      ? null
      : historySnapshots[selectedSnapshotIndex] ?? null;

  const visibleBoxes = displaySnapshot ? displaySnapshot.boxes : storedBoxes;
  const visibleFaultTypes = displaySnapshot
    ? displaySnapshot.faults
    : storedFaultTypes;
  const visibleAnnotatedBy = displaySnapshot
    ? displaySnapshot.annotatedBy
    : storedAnnotatedBy;
  const visibleSeverity = displaySnapshot
    ? displaySnapshot.severity
    : storedSeverity;
  const visibleComments = displaySnapshot
    ? displaySnapshot.comments
    : storedComments;
  const visibleStatuses = displaySnapshot
    ? displaySnapshot.statuses
    : storedStatuses;
  const visibleCreatedAt = displaySnapshot
    ? displaySnapshot.createdAt
    : storedCreatedAt;

  const visibleBoxInfo = useMemo(
    () => buildBoxInfo(visibleBoxes, visibleFaultTypes, visibleComments, visibleStatuses, visibleCreatedAt),
    [visibleBoxes, visibleFaultTypes, visibleComments, visibleStatuses, visibleCreatedAt]
  );

  const editingDisabled = selectedSnapshotIndex !== null;

  const visibleFaultSummary = useMemo(() => {
    if (!visibleBoxInfo.length)
      return [] as Array<{ fault: string; label: string; count: number }>;
    const counts = visibleBoxInfo.reduce<Record<string, number>>((acc, box) => {
      const key = canonicalizeFault(box.boxFault ?? "none");
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .map(([fault, count]) => ({ fault, label: toDisplayLabel(fault), count }))
      .sort((a, b) => b.count - a.count);
  }, [visibleBoxInfo]);

  const visibleBoxCount = useMemo(() => {
    if (!visibleBoxInfo.length) return 0;
    const anyToggleEnabled =
      overlayToggles.looseJoint ||
      overlayToggles.pointOverload ||
      overlayToggles.wireOverload;
    return visibleBoxInfo.reduce((count, box) => {
      const toggleKey = faultToToggleKey(box.boxFault);
      if (toggleKey) {
        return overlayToggles[toggleKey] ? count + 1 : count;
      }
      return anyToggleEnabled ? count + 1 : count;
    }, 0);
  }, [overlayToggles, visibleBoxInfo]);

  const historyOptions = useMemo(
    () =>
      historySnapshots.map((snapshot, index) => ({
        index,
        label: buildSnapshotLabel(snapshot, index, historySnapshots.length),
      })),
    [historySnapshots]
  );

  const historyOptionsDesc = useMemo(
    () => historyOptions.slice().reverse(),
    [historyOptions]
  );

  const currentVersionLabel = useMemo(() => {
    const ts = uploadedAt || inspection.imageUploadedAt || null;
    const formatted = formatTimestamp(ts);
    return formatted ? `Latest · ${formatted}` : "Latest (current)";
  }, [uploadedAt, inspection.imageUploadedAt]);

  const handleHistorySelect = (value: string) => {
    if (value === "current") {
      setSelectedSnapshotIndex(null);
      return;
    }
    const idx = Number.parseInt(value, 10);
    if (Number.isNaN(idx)) return;
    if (idx < 0 || idx >= historySnapshots.length) return;
    setSelectedSnapshotIndex(idx);
  };

  const hasSessionChanges = useMemo(() => {
    const initialSnapshot = initialStoredRef.current;
    const boxesChanged = !jsonEqual(storedBoxes, initialSnapshot.boxes);
    const faultsChanged = !jsonEqual(storedFaultTypes, initialSnapshot.faults);
    const annotatedChanged = !jsonEqual(
      storedAnnotatedBy,
      initialSnapshot.annotatedBy
    );
    const severityChanged = !jsonEqual(storedSeverity, initialSnapshot.severity);
    const commentsChanged = !jsonEqual(storedComments, initialSnapshot.comments);
    const statusesChanged = !jsonEqual(storedStatuses, initialSnapshot.statuses);
    const createdChanged = !jsonEqual(storedCreatedAt, initialSnapshot.createdAt);
    return (
      boxesChanged ||
      faultsChanged ||
      annotatedChanged ||
      severityChanged ||
      commentsChanged ||
      statusesChanged ||
      createdChanged ||
      pendingAdds.length > 0 ||
      pendingDeletes.length > 0
    );
  }, [
    storedBoxes,
    storedFaultTypes,
    storedAnnotatedBy,
    storedSeverity,
    storedComments,
    storedCreatedAt,
    storedStatuses,
    pendingAdds,
    pendingDeletes,
  ]);

  const resetSessionChanges = () => {
    const initialSnapshot = initialStoredRef.current;
    setStoredBoxes(cloneBoxes(initialSnapshot.boxes));
    setStoredFaultTypes(cloneStrings(initialSnapshot.faults));
    setStoredAnnotatedBy(cloneStrings(initialSnapshot.annotatedBy));
    setStoredSeverity(cloneSeverities(initialSnapshot.severity));
    setStoredComments(cloneComments(initialSnapshot.comments));
    setStoredStatuses(cloneStatuses(initialSnapshot.statuses));
    setPendingAdds([]);
    setPendingDeletes([]);
    setSelectedSnapshotIndex(null);
    setIsDrawMode(false);
    setDrawTarget(null);
    setPendingRect(null);
  };

  // When switching to a different inspection, reinitialize weather and image state
  useEffect(() => {
    setTuneModelEnabled(true);
    setSelectedWeather(
      (inspection.lastAnalysisWeather as string) ||
        inspection.weather ||
        "sunny"
    );
    setUploadedUrl(inspection.imageUrl || null);
    setUploadedAt(inspection.imageUploadedAt || null);
    setUploadedBy(inspection.imageUploadedBy || null);
    setAiStats(null);
    setPreviewUrl(null);
    // initialize stored analysis states from inspection
    try {
      const parsedBoxes = parseBoundingBoxes(inspection.boundingBoxes);
      const parsedFaults = parseFaultTypes(
        inspection.faultTypes,
        parsedBoxes.length
      );
      const parsedAnnotatedBy = parseAnnotatedBy(
        inspection.annotatedBy as string | null | undefined,
        parsedBoxes.length
      );
      const parsedSeverity = parseSeverities(
        inspection.severity,
        parsedBoxes.length
      );
      const parsedComments = parseComments(
        inspection.comment as string | (string | null)[] | null,
        parsedBoxes.length
      );
      const parsedStatuses = parseStatuses(
        inspection.recentStatus as string | string[] | null | undefined,
        parsedBoxes.length
      );
      const parsedCreatedAt = parseCreatedAt(
        inspection.boxCreatedAt as string | (string | null)[] | null,
        parsedBoxes.length
      );
      const clonedBoxes = cloneBoxes(parsedBoxes);
      const clonedFaults = cloneStrings(parsedFaults);
      const clonedAnnotated = cloneStrings(parsedAnnotatedBy);
      const clonedSeverity = cloneSeverities(parsedSeverity);
      const clonedComments = cloneComments(parsedComments);
      const clonedCreated = cloneTimestamps(parsedCreatedAt);
      const clonedStatuses = cloneStatuses(parsedStatuses);
      setStoredBoxes(clonedBoxes);
      setStoredFaultTypes(clonedFaults);
      setStoredAnnotatedBy(clonedAnnotated);
      setStoredSeverity(clonedSeverity);
      setStoredComments(clonedComments);
      setStoredCreatedAt(clonedCreated);
      setStoredStatuses(clonedStatuses);
      initialStoredRef.current = {
        boxes: cloneBoxes(clonedBoxes),
        faults: cloneStrings(clonedFaults),
        annotatedBy: cloneStrings(clonedAnnotated),
        severity: cloneSeverities(clonedSeverity),
        comments: cloneComments(clonedComments),
        createdAt: cloneTimestamps(clonedCreated),
        statuses: cloneStatuses(clonedStatuses),
      };
    } catch {
      setStoredBoxes([]);
      setStoredFaultTypes([]);
      setStoredAnnotatedBy([]);
      setStoredSeverity([]);
      setStoredComments([]);
      setStoredCreatedAt([]);
      setStoredStatuses([]);
      initialStoredRef.current = {
        boxes: [],
        faults: [],
        annotatedBy: [],
        severity: [],
        comments: [],
        createdAt: [],
        statuses: [],
      };
    }
    try {
      const boxHistoryEntries = parseHistoryEntries(
        inspection.boundingBoxHistory
      );
      const faultHistoryEntries = parseHistoryEntries(
        inspection.faultTypeHistory
      );
      const annotatedHistoryEntries = parseHistoryEntries(
        inspection.annotatedByHistory
      );
      const severityHistoryEntries = parseHistoryEntries(
        inspection.severityHistory
      );
      const commentHistoryEntries = parseHistoryEntries(
        inspection.commentHistory
      );
      const statusHistoryEntries = parseHistoryEntries(
        inspection.recentStatusHistory
      );
      const timestampHistoryEntries = parseHistoryEntries(
        inspection.timestampHistory
      );
      const createdHistoryEntries = parseHistoryEntries(
        inspection.boxCreatedAtHistory
      );
      const maxSnapshots = Math.max(
        boxHistoryEntries.length,
        faultHistoryEntries.length,
        annotatedHistoryEntries.length,
        severityHistoryEntries.length,
        commentHistoryEntries.length,
        statusHistoryEntries.length,
        timestampHistoryEntries.length,
        createdHistoryEntries.length
      );
      const snapshots: HistorySnapshot[] = [];
      for (let idx = 0; idx < maxSnapshots; idx += 1) {
        const boxesRaw = boxHistoryEntries[idx] as Inspection["boundingBoxes"];
        const faultsRaw = faultHistoryEntries[idx] as Inspection["faultTypes"];
        const annotatedRaw = annotatedHistoryEntries[idx] as
          | string
          | string[]
          | null
          | undefined;
        const severityRaw = severityHistoryEntries[idx] as Inspection["severity"];
        const commentRaw = commentHistoryEntries[idx] as
          | Inspection["comment"]
          | null
          | undefined;
        const boxes = parseBoundingBoxes(boxesRaw);
        const faultsFallbackLength = Array.isArray(faultsRaw)
          ? (faultsRaw as unknown[]).length
          : 0;
        const annotatedFallbackLength = Array.isArray(annotatedRaw)
          ? (annotatedRaw as unknown[]).length
          : 0;
        const severityFallbackLength = Array.isArray(severityRaw)
          ? (severityRaw as unknown[]).length
          : 0;
        const commentFallbackLength = Array.isArray(commentRaw)
          ? (commentRaw as unknown[]).length
          : 0;
        const statusRawEntry = statusHistoryEntries[idx];
        const statusFallbackLength = Array.isArray(statusRawEntry)
          ? (statusRawEntry as unknown[]).length
          : 0;
        const createdRawEntry = createdHistoryEntries[idx];
        const createdFallbackLength = Array.isArray(createdRawEntry)
          ? (createdRawEntry as unknown[]).length
          : 0;
        const targetLength = Math.max(
          boxes.length,
          faultsFallbackLength,
          annotatedFallbackLength,
          severityFallbackLength,
          commentFallbackLength,
          statusFallbackLength,
          createdFallbackLength
        );
        const effectiveLength = targetLength > 0 ? targetLength : boxes.length;
        const faults = parseFaultTypes(faultsRaw, effectiveLength);
        const annotated = parseAnnotatedBy(annotatedRaw, effectiveLength);
        const severitySnapshot = parseSeverities(severityRaw, effectiveLength);
        const commentsSnapshot = parseComments(commentRaw ?? null, effectiveLength);
        const statusRaw = statusRawEntry as
          | string
          | string[]
          | null
          | undefined;
        const statusesSnapshot = parseStatuses(statusRaw, effectiveLength);
        const createdSnapshot = parseCreatedAt(
          createdRawEntry as string | (string | null)[] | null,
          effectiveLength
        );
        const timestampEntry = timestampHistoryEntries[idx];
        const timestamp =
          typeof timestampEntry === "string"
            ? timestampEntry
            : timestampEntry != null
            ? String(timestampEntry)
            : null;
        const hasBoxes = boxes.length > 0;
        const hasTimestamp = typeof timestamp === "string" && timestamp.length > 0;
        const hasFaultData = faults.some(
          (fault) => canonicalizeFault(fault) !== "none"
        );
        if (!hasBoxes && !hasFaultData && !hasTimestamp) {
          continue;
        }
        snapshots.push({
          boxes,
          faults,
          annotatedBy: annotated,
          severity: severitySnapshot,
          comments: commentsSnapshot,
          statuses: statusesSnapshot,
          createdAt: createdSnapshot,
          timestamp,
        });
      }
      setHistorySnapshots(snapshots);
    } catch {
      setHistorySnapshots([]);
    }
    setSelectedSnapshotIndex(null);
  setIsDrawMode(false);
  setDrawTarget(null);
  setPendingRect(null);
    // reset any queued changes when inspection changes or reloads
    setPendingAdds([]);
    setPendingDeletes([]);
    // Also update when boundingBoxes/faultTypes/imageUrl change on the same inspection id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    inspection.id,
    inspection.boundingBoxes,
    inspection.faultTypes,
    inspection.imageUrl,
    inspection.boundingBoxHistory,
    inspection.faultTypeHistory,
    inspection.annotatedByHistory,
    inspection.severityHistory,
    inspection.comment,
    inspection.commentHistory,
    inspection.recentStatus,
    inspection.recentStatusHistory,
    inspection.timestampHistory,
  ]);

  useEffect(() => {
    if (aiStats || visibleBoxInfo.length === 0) return;
    setOverlayToggles((prev) => {
      const next = { ...prev } as OverlayToggles;
      let changed = false;
      for (const box of visibleBoxInfo) {
        const key = faultToToggleKey(box.boxFault);
        if (key && !next[key]) {
          next[key] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [aiStats, visibleBoxInfo]);

  useEffect(() => {
    if (selectedSnapshotIndex !== null) {
      setIsDrawMode(false);
      setDrawTarget(null);
      setPendingRect(null);
    }
  }, [selectedSnapshotIndex]);

  useEffect(() => {
    if (historySnapshots.length === 0 && selectedSnapshotIndex !== null) {
      setSelectedSnapshotIndex(null);
    }
  }, [historySnapshots.length, selectedSnapshotIndex]);

  const handleUpload = async (file: File, weather: string) => {
    if (!inspection.id) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("weather", weather);
    const res = await fetch(
      apiUrl(`/api/inspections/${inspection.id}/upload`),
      {
        method: "POST",
        body: formData,
        headers: {
          "x-username":
            typeof window !== "undefined"
              ? localStorage.getItem("username") || ""
              : "",
        },
      }
    );
    if (res.ok) {
      const updated = await res.json();
      setUploadedUrl(updated.imageUrl ?? null);
      setSelectedWeather(updated.weather || selectedWeather);
      setUploadedAt(updated.imageUploadedAt || null);
      setUploadedBy(updated.imageUploadedBy || uploadedBy);
      // Clear any previous analysis overlays for new image
      setAiStats(null);
    }
    await reload();
  };

  // Flush final local state to backend in one update, then reload and close
  const flushAndClose = async () => {
    if (!inspection.id) {
      onClose();
      return;
    }
    if (!hasSessionChanges) {
      onClose();
      return;
    }
    setIsClosing(true);
    try {
      const username =
        typeof window !== "undefined" ? localStorage.getItem("username") || "" : "";
      // Send the final local boxes, faultTypes, and annotatedBy as a single bulk update
      const finalBoxes = storedBoxes.map((b) => [b[0], b[1], b[2], b[3]]);
      const finalFaults = storedFaultTypes.slice();
      const finalAnnotatedBy = storedAnnotatedBy.slice();
      const finalComments = storedComments.map((value) => {
        if (typeof value === "string") {
          const trimmed = value.trim();
          return trimmed.length > 0 ? trimmed : null;
        }
        return null;
      });
      await fetch(apiUrl(`/api/inspections/${inspection.id}/boxes/bulk`), {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-username": username,
        },
        body: JSON.stringify({
          boundingBoxes: finalBoxes,
          faultTypes: finalFaults,
          annotatedBy: finalAnnotatedBy,
          comments: finalComments,
          tuneModel: tuneModelEnabled,
        }),
      });
      initialStoredRef.current = {
        boxes: cloneBoxes(storedBoxes),
        faults: cloneStrings(storedFaultTypes),
        annotatedBy: cloneStrings(storedAnnotatedBy),
        severity: cloneSeverities(storedSeverity),
        comments: cloneComments(storedComments),
        createdAt: cloneTimestamps(storedCreatedAt),
        statuses: cloneStatuses(storedStatuses),
      };
      setPendingAdds([]);
      setPendingDeletes([]);
      await reload();
    } catch {
      // best-effort; still close
    } finally {
      setIsClosing(false);
      onClose();
    }
  };

  const handleResetModelClick = () => {
    setResetModelMessage(null);
    setResetModelError(null);
    setShowResetModelConfirm(true);
  };

  const closeResetModelModal = () => {
    if (isResettingModel) return;
    setShowResetModelConfirm(false);
  };

  const handleConfirmResetModel = async () => {
    setIsResettingModel(true);
    setResetModelError(null);
    try {
      const username =
        typeof window !== "undefined" ? localStorage.getItem("username") || "" : "";
      const response = await fetch(apiUrl(`/api/inspections/model/reset`), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-username": username,
        },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Reset failed (${response.status})`);
      }
      const payload: unknown = await response
        .json()
        .catch(() => null);
      let actor: string | undefined;
      if (typeof payload === "object" && payload !== null) {
        const candidate = (payload as { resetBy?: unknown }).resetBy;
        if (typeof candidate === "string") {
          actor = candidate;
        }
      }
      setShowResetModelConfirm(false);
      setResetModelMessage(
        actor && actor.trim().length > 0
          ? `AI parameters reset to defaults by ${actor}.`
          : "AI parameters reset to defaults."
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to reset model parameters.";
      setResetModelError(message);
    } finally {
      setIsResettingModel(false);
    }
  };

  const closeFaultModal = () => {
    setShowFaultModal(false);
    setPendingRect(null);
    setIsDrawMode(false);
    setDrawTarget(null);
    setCommentInput("");
    setEditIndex(null);
    setModalMode("add");
    setEditSource(null);
    setEditOriginalRect(null);
    setEditSelectionMode(null);
    setAwaitingRedraw(false);
  };

  const handleStoredBoxEdit = (
    index: number,
    boxOverride?: { x: number; y: number; w: number; h: number }
  ) => {
    if (editingDisabled) return;
    const box = storedBoxes[index];
    if (!box) return;
    const rect = {
      x: boxOverride?.x ?? box[0],
      y: boxOverride?.y ?? box[1],
      w: boxOverride?.w ?? box[2],
      h: boxOverride?.h ?? box[3],
    };
    setModalMode("edit");
    setEditIndex(index);
    setEditSource("stored");
    setEditOriginalRect(rect);
    setAwaitingRedraw(false);
    setEditSelectionMode(null);
    setFaultSelection(storedFaultTypes[index] ?? "none");
    setCommentInput(storedComments[index] ?? "");
    setPendingRect(rect);
    setShowFaultModal(true);
    setIsDrawMode(false);
    setDrawTarget(null);
  };

  const handleAiBoxEdit = (
    index: number,
    boxOverride?: { x: number; y: number; w: number; h: number }
  ) => {
    if (!storedBoxes[index]) return;
    const rect = {
      x: boxOverride?.x ?? storedBoxes[index][0],
      y: boxOverride?.y ?? storedBoxes[index][1],
      w: boxOverride?.w ?? storedBoxes[index][2],
      h: boxOverride?.h ?? storedBoxes[index][3],
    };
    setModalMode("edit");
    setEditIndex(index);
    setEditSource("ai");
    setEditOriginalRect(rect);
    setAwaitingRedraw(false);
    setEditSelectionMode(null);
    setFaultSelection(storedFaultTypes[index] ?? "none");
    setCommentInput(storedComments[index] ?? "");
    setPendingRect(rect);
    setShowFaultModal(true);
    setIsDrawMode(false);
    setDrawTarget(null);
  };

  const requestBoundingBoxRedraw = () => {
    if (!editSource) return;
    if (editingDisabled) return;
    const target = editSource === "stored" ? "stored-edit" : "ai-edit";
    setModalMode("edit");
    setShowFaultModal(false);
    setIsDrawMode(true);
    setDrawTarget(target);
    setPendingRect(null);
    setAwaitingRedraw(true);
    setEditSelectionMode(null);
  };

  const handleModalSave = () => {
    if (!inspection.id) {
      closeFaultModal();
      return;
    }
    const ft = faultSelection;
    const trimmed = commentInput.trim();
    const commentValue = trimmed.length > 0 ? trimmed : null;
    const username =
      typeof window !== "undefined"
        ? localStorage.getItem("username") || "user"
        : "user";

    if (modalMode === "edit" && editIndex !== null) {
      const targetIndex = editIndex;
      const originalRect = editOriginalRect;
      const resolvedRect = pendingRect ?? editOriginalRect;
      if (!originalRect || !resolvedRect) {
        closeFaultModal();
        return;
      }
      const coordsChanged = !rectsEqual(resolvedRect, originalRect);
      const newBoxArray = [
        resolvedRect.x,
        resolvedRect.y,
        resolvedRect.w,
        resolvedRect.h,
      ];

      setStoredBoxes((prev) => {
        const next = prev.slice();
        if (targetIndex >= 0 && targetIndex < next.length) {
          next.splice(targetIndex, 1, newBoxArray);
        }
        return next;
      });
      setStoredFaultTypes((prev) => {
        const next = prev.slice();
        if (targetIndex >= 0 && targetIndex < next.length) {
          next[targetIndex] = ft;
        }
        return next;
      });
      setStoredAnnotatedBy((prev) => {
        const next = prev.slice();
        if (targetIndex >= 0 && targetIndex < next.length) {
          next[targetIndex] = username;
        }
        return next;
      });
      setStoredSeverity((prev) => {
        const next = prev.slice();
        if (targetIndex >= 0 && targetIndex < next.length) {
          next[targetIndex] = null;
        }
        return next;
      });
      setStoredComments((prev) => {
        const next = prev.slice();
        if (targetIndex >= 0 && targetIndex < next.length) {
          next[targetIndex] = commentValue;
        }
        return next;
      });
      setStoredStatuses((prev) => {
        const next = prev.slice();
        if (targetIndex >= 0 && targetIndex < next.length) {
          next[targetIndex] = next[targetIndex] === "added" ? "added" : "edited";
        }
        return next;
      });

      const oldRectObj = {
        x: originalRect.x,
        y: originalRect.y,
        w: originalRect.w,
        h: originalRect.h,
      };
      const newRectObj = {
        x: resolvedRect.x,
        y: resolvedRect.y,
        w: resolvedRect.w,
        h: resolvedRect.h,
      };

      let replacedExistingAdd = false;
      setPendingAdds((prev) => {
        const next = prev.slice();
        const existingIdx = next.findIndex((a) => sameBox(a, oldRectObj));
        if (existingIdx >= 0) {
          replacedExistingAdd = true;
          next[existingIdx] = {
            x: newRectObj.x,
            y: newRectObj.y,
            w: newRectObj.w,
            h: newRectObj.h,
            faultType: ft,
            comment: commentValue,
          };
          return next;
        }
        const newIdx = next.findIndex((a) => sameBox(a, newRectObj));
        if (newIdx >= 0) {
          next[newIdx] = {
            ...next[newIdx],
            faultType: ft,
            comment: commentValue,
          };
          return next;
        }
        next.push({
          x: newRectObj.x,
          y: newRectObj.y,
          w: newRectObj.w,
          h: newRectObj.h,
          faultType: ft,
          comment: commentValue,
        });
        return next;
      });
      if (coordsChanged && !replacedExistingAdd) {
        setPendingDeletes((prev) => {
          if (prev.some((entry) => sameBox(entry, oldRectObj))) return prev;
          return [...prev, oldRectObj];
        });
      }

      setAiStats((prev) => {
        if (!prev) return prev;
        const next = { ...prev };
        if (Array.isArray(next.boxes)) {
          next.boxes = (next.boxes as number[][]).map((entry, idx) => {
            if (idx !== targetIndex) return entry.slice();
            return [
              resolvedRect.x,
              resolvedRect.y,
              resolvedRect.w,
              resolvedRect.h,
            ];
          });
        }
        if (Array.isArray(next.boxInfo)) {
          next.boxInfo = (next.boxInfo as OverlayBoxInfo[]).map((entry, idx) => {
            const updated = { ...entry };
            if (idx === targetIndex) {
              updated.x = resolvedRect.x;
              updated.y = resolvedRect.y;
              updated.w = resolvedRect.w;
              updated.h = resolvedRect.h;
              updated.boxFault = ft;
              if (commentValue && commentValue.length > 0) {
                updated.comment = commentValue;
              } else {
                delete updated.comment;
              }
              updated.annotatedBy = username;
              if ("severity" in updated) {
                (updated as { severity?: number | null }).severity = undefined;
              }
            }
            return updated;
          });
        }
        return next;
      });

      const toggleKey = faultToToggleKey(ft);
      if (toggleKey) {
        setOverlayToggles(
          (prev) => ({ ...prev, [toggleKey]: true } as OverlayToggles)
        );
      }
      closeFaultModal();
      return;
    }

    if (!pendingRect) {
      closeFaultModal();
      return;
    }

    const rect = pendingRect;
    setStoredBoxes((prev) => [...prev, [rect.x, rect.y, rect.w, rect.h]]);
    setStoredFaultTypes((prev) => [...prev, ft]);
    setStoredAnnotatedBy((prev) => [...prev, username]);
    setStoredSeverity((prev) => [...prev, null]);
    setStoredComments((prev) => [...prev, commentValue]);
    setStoredStatuses((prev) => [...prev, "added"]);
    setPendingAdds((prev) => [
      ...prev,
      {
        x: rect.x,
        y: rect.y,
        w: rect.w,
        h: rect.h,
        faultType: ft,
        comment: commentValue,
      },
    ]);
    const toggleKey = faultToToggleKey(ft);
    if (toggleKey) {
      setOverlayToggles(
        (prev) => ({ ...prev, [toggleKey]: true } as OverlayToggles)
      );
    }
    setAiStats((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      const boxesList = Array.isArray(next.boxes)
        ? (next.boxes as number[][]).slice()
        : [];
      boxesList.push([rect.x, rect.y, rect.w, rect.h]);
      next.boxes = boxesList;
      const infoList = Array.isArray(next.boxInfo)
        ? (next.boxInfo as OverlayBoxInfo[]).map((entry) => ({ ...entry }))
        : [];
      infoList.push({
        x: rect.x,
        y: rect.y,
        w: rect.w,
        h: rect.h,
        boxFault: ft,
        comment: commentValue ?? undefined,
        annotatedBy: username,
      });
      next.boxInfo = infoList;
      return next;
    });
    closeFaultModal();
  };

  const handleModalCancel = () => {
    closeFaultModal();
  };

  const handleExport = async () => {
    if (!inspection.id || isExporting) return;
    setIsExporting(true);
    try {
      const response = await fetch(
        apiUrl(`/api/inspections/${inspection.id}/export`)
      );
      if (!response.ok) {
        throw new Error(`Export failed (${response.status})`);
      }
      const blob = await response.blob();
      const safeBase = (inspection.inspectionNumber || inspection.id)
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .trim() || "inspection";
      const filename = `${safeBase}-export.zip`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export inspection metadata", error);
      if (typeof window !== "undefined") {
        window.alert("Unable to export inspection metadata. Please try again.");
      }
    } finally {
      setIsExporting(false);
    }
  };

  const uploadBaseline = async (file: File, weather: string) => {
    if (!transformer?.id) return;
    const form = new FormData();
    form.append("file", file);
    form.append("weather", weather);
    await fetch(apiUrl(`/api/transformers/${transformer.id}/baseline`), {
      method: "POST",
      body: form,
      headers: {
        "x-username":
          typeof window !== "undefined"
            ? localStorage.getItem("username") || ""
            : "",
      },
    });
    await reloadTransformers();
    // After successful upload and reload, clear local preview to show persisted baseline
    setBaselinePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  // Revoke preview object URL on unmount or when changed
  useEffect(() => {
    return () => {
      if (baselinePreviewUrl) URL.revokeObjectURL(baselinePreviewUrl);
    };
  }, [baselinePreviewUrl]);

  return (
    <>
      <div className="details-panel border rounded-lg shadow-lg mb-6 p-6 transition-colors">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-xl font-bold">Inspection Details</h2>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleExport}
            disabled={!inspection.id || isExporting}
            className="inline-flex items-center gap-2 px-3 py-1 text-sm border rounded custombutton disabled:opacity-60 disabled:cursor-not-allowed"
            title="Download inspection metadata and history"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <path d="M12 3v12" />
              <path d="M6 11l6 6 6-6" />
              <path d="M5 21h14" />
            </svg>
            <span>{isExporting ? "Preparing…" : "Export data"}</span>
          </button>
          <label className="flex items-center gap-2 text-sm">
            <span>Tune model</span>
            <span className="relative inline-flex h-5 w-10 items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={tuneModelEnabled}
                disabled={isResettingModel}
                onChange={(event) => setTuneModelEnabled(event.target.checked)}
              />
              <span className="pointer-events-none absolute inset-0 rounded-full bg-gray-400 transition-colors peer-checked:bg-green-500" />
              <span className="pointer-events-none absolute left-1 top-1 h-3 w-3 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
            </span>
          </label>
          <button
            type="button"
            onClick={handleResetModelClick}
            disabled={isResettingModel}
            className="inline-flex items-center gap-2 px-3 py-1 text-sm border rounded custombutton disabled:opacity-60 disabled:cursor-not-allowed"
            title="Reset AI parameters to their defaults"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <path d="M4 4v6h6" />
              <path d="M20 20v-6h-6" />
              <path d="M20 9.5A7.5 7.5 0 0 0 11 2h-1" />
              <path d="M4 14.5A7.5 7.5 0 0 0 13 22h1" />
            </svg>
            <span>{isResettingModel ? "Resetting…" : "Reset model"}</span>
          </button>
          <button onClick={flushAndClose} className="text-gray-400 hover:text-gray-600" disabled={isClosing}>
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {!showResetModelConfirm && resetModelMessage && (
        <div className="mb-4 text-sm text-green-600">{resetModelMessage}</div>
      )}
      {!showResetModelConfirm && resetModelError && (
        <div className="mb-4 text-sm text-red-600">{resetModelError}</div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-bold">Inspection Number</label>
          <p className="mt-1 text-sm">{inspection.inspectionNumber}</p>
        </div>
        <div>
          <label className="block text-sm font-bold">Transformer Number</label>
          <p className="mt-1 text-sm">{inspection.transformerNumber}</p>
        </div>
        <div>
          <label className="block text-sm font-bold">Branch</label>
          <p className="mt-1 text-sm">{inspection.branch}</p>
        </div>
        <div>
          <label className="block text-sm font-bold">Inspected Date</label>
          <p className="mt-1 text-sm">{inspection.inspectedDate}</p>
        </div>
        <div>
          <label className="block text-sm font-bold">Maintenance Date</label>
          <p className="mt-1 text-sm">{inspection.maintainanceDate || "N/A"}</p>
        </div>
        <div>
          <label className="block text-sm font-bold">Status</label>
          <span
            className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
              inspection.status === "Pending"
                ? "bg-red-100 text-red-800 border border-red-300"
                : inspection.status === "In Progress"
                ? "bg-green-100 text-green-800 border border-green-300"
                : inspection.status === "Completed"
                ? "bg-purple-100 text-purple-800 border border-purple-300"
                : "bg-gray-100 text-gray-800 border border-gray-300"
            }`}
          >
            {inspection.status}
          </span>
        </div>
        {inspection.uploadedBy && (
          <div className="col-span-2">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
              Uploaded by
            </label>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {inspection.uploadedBy}
            </p>
          </div>
        )}
      </div>

      <div className="border-t pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Thermal Image
          </h3>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1 text-sm border rounded custombutton"
              title="Clear stored image and analysis"
              onClick={async () => {
                if (!inspection.id) return;
                try {
                  await fetch(
                    apiUrl(`/api/inspections/${inspection.id}/clear-analysis`),
                    { method: "POST" }
                  );
                  // Reset local UI state
                  setPreviewUrl(null);
                  setUploadedUrl(null);
                  setUploadedAt(null);
                  setUploadedBy(null);
                  setAiStats(null);
                  // Clear local stored analysis immediately
                  setStoredBoxes([]);
                  setStoredFaultTypes([]);
                  setStoredAnnotatedBy([]);
                  setStoredSeverity([]);
                  setStoredComments([]);
                  setStoredCreatedAt([]);
                  setStoredStatuses([]);
                  initialStoredRef.current = {
                    boxes: [],
                    faults: [],
                    annotatedBy: [],
                    severity: [],
                    comments: [],
                    createdAt: [],
                    statuses: [],
                  };
                  // Also clear any pending changes
                  setPendingAdds([]);
                  setPendingDeletes([]);
                  await reload();
                  await reloadTransformers();
                } catch {
                  // no-op
                }
              }}
            >
              Clear analysis
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Uploader */}
          <ThermalImage
            onImageUpload={(file) => handleUpload(file, selectedWeather)}
            onWeatherChange={(w) => setSelectedWeather(w)}
            defaultWeather={selectedWeather}
            onAnalyze={() => {
              /* handled inside component */
            }}
            onResetAnalysis={() => {
              setAiStats(null);
            }}
            inspectionId={inspection.id as string}
            onPreviewUrl={(u) => setPreviewUrl(u)}
            onAnalysisResult={(res) => {
              const normalizedBoxInfo: (OverlayBoxInfo & {
                severity?: number;
                severityLabel?: string;
                avgDeltaV?: number;
                maxDeltaV?: number;
                annotatedBy?: string | null;
              })[] = Array.isArray(res.boxInfo)
                ? res.boxInfo.map((entry) => {
                    const candidate = (entry as { annotatedBy?: string | null }).annotatedBy;
                    const annotator =
                      typeof candidate === "string" && candidate.trim().length > 0
                        ? candidate.trim()
                        : "AI";
                    return { ...entry, annotatedBy: annotator };
                  })
                : [];
              const createdFromResponse = parseCreatedAt(
                (res as { boxCreatedAt?: unknown }).boxCreatedAt,
                normalizedBoxInfo.length
              );
              const enrichedBoxInfo = normalizedBoxInfo.map((entry, index) => ({
                ...entry,
                createdAt: createdFromResponse[index] ?? new Date().toISOString(),
              }));
              setAiStats({
                prob: res.prob,
                histDistance: res.histDistance,
                dv95: res.dv95,
                warmFraction: res.warmFraction,
                boxes: res.boxes as number[][] | number[],
                boxInfo: enrichedBoxInfo,
                imageWidth: res.imageWidth,
                imageHeight: res.imageHeight,
                overallSeverity: res.overallSeverity,
                overallSeverityLabel: res.overallSeverityLabel,
              });
              // Sync AI results into stored state so they are included on flush
              const aiBoxes = res.boxes as number[][];
              const aiBoxInfo = enrichedBoxInfo;
              if (Array.isArray(aiBoxes)) {
                const clonedBoxes = cloneBoxes(aiBoxes);
                const aiFaults = aiBoxInfo.map((bi: OverlayBoxInfo) => bi.boxFault || "none");
                const clonedFaults = cloneStrings(aiFaults);
                const aiAnnotated = Array(aiBoxes.length).fill("AI");
                const severityValues = aiBoxInfo.map(
                  (bi: OverlayBoxInfo & { severity?: number | null }) =>
                    typeof bi?.severity === "number" ? bi.severity : null
                );
                const commentValues = Array(aiBoxes.length).fill(null);
                const statusValues = Array(aiBoxes.length).fill(
                  null as "added" | "edited" | "deleted" | null
                );
                const createdValues = aiBoxInfo.map((bi) => bi.createdAt ?? new Date().toISOString());
                setStoredBoxes(clonedBoxes);
                setStoredFaultTypes(clonedFaults);
                // All AI-detected boxes are annotated by "AI"
                setStoredAnnotatedBy(aiAnnotated);
                setStoredSeverity(severityValues);
                setStoredComments(commentValues);
                setStoredCreatedAt(cloneTimestamps(createdValues));
                setStoredStatuses(statusValues);
                initialStoredRef.current = {
                  boxes: cloneBoxes(clonedBoxes),
                  faults: cloneStrings(clonedFaults),
                  annotatedBy: cloneStrings(aiAnnotated),
                  severity: cloneSeverities(severityValues),
                  comments: cloneComments(commentValues),
                  createdAt: cloneTimestamps(createdValues),
                  statuses: cloneStatuses(statusValues),
                };
                setPendingAdds([]);
                setPendingDeletes([]);
              }
              // Persisted on backend; optimistically update local selected weather and image
              setSelectedWeather(selectedWeather);
              // Ensure the uploaded image remains the default shown after analysis
              if (previewUrl) setUploadedUrl(previewUrl);
              // Reload list to pull updated lastAnalysisWeather and weather
              void reload();
            }}
          />

          {/* Side-by-side Comparison */}
          <div className="details-panel rounded-lg p-4 transition-colors">
            <h4 className="text-2xl font-bold mb-6">Comparison</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm mb-1">Baseline ({selectedWeather})</p>
                {baselinePreviewUrl || baselineForWeather(selectedWeather) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      (baselinePreviewUrl ||
                        baselineForWeather(selectedWeather)) as string
                    }
                    alt="Baseline"
                    className="w-full h-56 object-contain border border-gray-200 dark:border-gray-700 rounded"
                  />
                ) : (
                  <div className="w-full h-56 flex flex-col gap-2 items-center justify-center border border-gray-200 dark:border-gray-700 rounded">
                    <span>No baseline</span>
                    <label className="px-3 py-1 text-sm rounded cursor-pointer custombutton">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            const url = URL.createObjectURL(f);
                            setBaselinePreviewUrl(url);
                            uploadBaseline(f, selectedWeather);
                          }
                        }}
                      />
                      Add baseline
                    </label>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm mb-1">Uploaded</p>
                {effectiveUploadedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={effectiveUploadedUrl as string}
                    alt="Uploaded"
                    className="w-full h-56 object-contain border border-gray-200 dark:border-gray-700 rounded"
                  />
                ) : (
                  <div className="w-full h-56 flex items-center justify-center border border-gray-200 dark:border-gray-700 rounded text-gray-400">
                    No image uploaded
                  </div>
                )}
                {(uploadedBy ||
                  uploadedAt ||
                  inspection.imageUploadedBy ||
                  inspection.imageUploadedAt) && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    by {uploadedBy || inspection.imageUploadedBy || "unknown"}
                    {uploadedAt || inspection.imageUploadedAt
                      ? ` on ${new Date(
                          uploadedAt || (inspection.imageUploadedAt as string)
                        ).toLocaleString()}`
                      : ""}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center gap-4 mb-2">
                <button
                  className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded"
                  onClick={() => {
                    const allOn =
                      overlayToggles.looseJoint &&
                      overlayToggles.pointOverload &&
                      overlayToggles.wireOverload;
                    setOverlayToggles({
                      looseJoint: !allOn,
                      pointOverload: !allOn,
                      wireOverload: !allOn,
                    });
                  }}
                >
                  {overlayToggles.looseJoint &&
                  overlayToggles.pointOverload &&
                  overlayToggles.wireOverload
                    ? "Show none"
                    : "Show all"}
                </button>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={overlayToggles.looseJoint}
                    onChange={(e) =>
                      setOverlayToggles((t) => ({
                        ...t,
                        looseJoint: e.target.checked,
                      }))
                    }
                  />
                  Loose joint
                </label>
                <label className="flex items-center gap-2 text-sm ">
                  <input
                    type="checkbox"
                    checked={overlayToggles.pointOverload}
                    onChange={(e) =>
                      setOverlayToggles((t) => ({
                        ...t,
                        pointOverload: e.target.checked,
                      }))
                    }
                  />
                  Point overload
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={overlayToggles.wireOverload}
                    onChange={(e) =>
                      setOverlayToggles((t) => ({
                        ...t,
                        wireOverload: e.target.checked,
                      }))
                    }
                  />
                  Wire overload
                </label>
              </div>
              {(previewUrl || effectiveUploadedUrl) && aiStats ? (
                <div className="overscroll-none overflow-hidden">
                  <OverlayedThermal
                    imageUrl={(previewUrl || effectiveUploadedUrl) as string}
                    naturalWidth={aiStats.imageWidth}
                    naturalHeight={aiStats.imageHeight}
                    boxes={(aiStats.boxes as number[][]) ?? []}
                    boxInfo={(aiStats.boxInfo ?? []).map((bi, i) => ({
                      ...bi,
                      label: String(i + 1),
                    }))}
                    toggles={overlayToggles}
                    allowDraw={
                      isDrawMode &&
                      (drawTarget === "ai" || drawTarget === "ai-edit")
                    }
                    onDrawComplete={(rect) => {
                      if (drawTarget === "ai-edit") {
                        setPendingRect(rect);
                        setModalMode("edit");
                        setIsDrawMode(false);
                        setDrawTarget(null);
                        setAwaitingRedraw(false);
                        setShowFaultModal(true);
                      } else {
                        setPendingRect(rect);
                        setModalMode("add");
                        setEditIndex(null);
                        setCommentInput("");
                        setShowFaultModal(true);
                        setIsDrawMode(false);
                        setDrawTarget(null);
                      }
                    }}
                    resetKey={`${inspection.id}-ai`}
                    onSelectBox={(
                      idx: number,
                      box: { x: number; y: number; w: number; h: number },
                      source?: "click" | "button"
                    ) => {
                      if (editingDisabled) return;
                      if (source !== "button" && editSelectionMode !== "ai") {
                        return;
                      }
                      handleAiBoxEdit(idx, box);
                    }}
                    onRemoveBox={async (idx, box) => {
                      if (!inspection.id) return;
                      // Determine coords to delete before mutating state
                      const del = box || (() => {
                        const info = aiStats?.boxInfo as OverlayBoxInfo[] | undefined;
                        if (info && info[idx]) {
                          const b = info[idx];
                          return { x: b.x, y: b.y, w: b.w, h: b.h };
                        }
                        const arr = aiStats?.boxes as number[][] | undefined;
                        if (arr && arr[idx]) {
                          const b = arr[idx];
                          return { x: b[0], y: b[1], w: b[2], h: b[3] };
                        }
                        return undefined;
                      })();
                      const removalIndex = (() => {
                        if (del) {
                          const found = storedBoxes.findIndex(
                            (b) =>
                              b &&
                              b.length >= 4 &&
                              Math.round(b[0]) === Math.round(del.x) &&
                              Math.round(b[1]) === Math.round(del.y) &&
                              Math.round(b[2]) === Math.round(del.w) &&
                              Math.round(b[3]) === Math.round(del.h)
                          );
                          if (found >= 0) return found;
                        }
                        return idx;
                      })();
                      // Optimistically update local aiStats only; queue deletion to persist on close
                      setAiStats((prev) => {
                        if (!prev) return prev;
                        const next = { ...prev };
                        if (Array.isArray(next.boxes)) {
                          const arr = (next.boxes as number[][]).slice();
                          if (del) {
                            const matchIdx = arr.findIndex(
                              (b) =>
                                b &&
                                b.length >= 4 &&
                                b[0] === del.x &&
                                b[1] === del.y &&
                                b[2] === del.w &&
                                b[3] === del.h
                            );
                            if (matchIdx >= 0) arr.splice(matchIdx, 1);
                            else arr.splice(idx, 1);
                          } else {
                            arr.splice(idx, 1);
                          }
                          next.boxes = arr;
                        }
                        if (Array.isArray(next.boxInfo)) {
                          const info = (next.boxInfo as OverlayBoxInfo[]).slice();
                          if (del) {
                            const matchInfoIdx = info.findIndex(
                              (bi) =>
                                bi &&
                                bi.x === del.x &&
                                bi.y === del.y &&
                                bi.w === del.w &&
                                bi.h === del.h
                            );
                            if (matchInfoIdx >= 0) info.splice(matchInfoIdx, 1);
                            else info.splice(idx, 1);
                          } else {
                            info.splice(idx, 1);
                          }
                          next.boxInfo = info;
                        }
                        return next;
                      });
                      if (removalIndex >= 0) {
                        setStoredBoxes((prev) => {
                          const next = prev.slice();
                          if (removalIndex >= 0 && removalIndex < next.length) {
                            next.splice(removalIndex, 1);
                          }
                          return next;
                        });
                        setStoredFaultTypes((prev) => {
                          const next = prev.slice();
                          if (removalIndex >= 0 && removalIndex < next.length) {
                            next.splice(removalIndex, 1);
                          }
                          return next;
                        });
                        setStoredAnnotatedBy((prev) => {
                          const next = prev.slice();
                          if (removalIndex >= 0 && removalIndex < next.length) {
                            next.splice(removalIndex, 1);
                          }
                          return next;
                        });
                        setStoredSeverity((prev) => {
                          const next = prev.slice();
                          if (removalIndex >= 0 && removalIndex < next.length) {
                            next.splice(removalIndex, 1);
                          }
                          return next;
                        });
                        setStoredComments((prev) => {
                          const next = prev.slice();
                          if (removalIndex >= 0 && removalIndex < next.length) {
                            next.splice(removalIndex, 1);
                          }
                          return next;
                        });
                        setStoredStatuses((prev) => {
                          const next = prev.slice();
                          if (removalIndex >= 0 && removalIndex < next.length) {
                            next.splice(removalIndex, 1);
                          }
                          return next;
                        });
                      }
                      if (del) {
                        setPendingDeletes((prev) => {
                          // if this box was added in this session, cancel the add instead of enqueueing delete
                          const addIdx = pendingAdds.findIndex((a) => sameBox(a, del));
                          if (addIdx >= 0) {
                            const na = pendingAdds.slice();
                            na.splice(addIdx, 1);
                            setPendingAdds(na);
                            return prev;
                          }
                          return [...prev, del];
                        });
                      }
                    }}
                    containerClassName="w-full border rounded overflow-hidden"
                  />
                  {/* Add box button for AI overlay */}
                  <div className="mt-2 flex gap-2">
                    <button
                      className={`px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded custombutton$`}
                      onClick={() => {
                        setIsDrawMode(true);
                        setDrawTarget("ai");
                      }}
                    >
                      {isDrawMode && drawTarget === "ai"
                        ? "Drawing: click-drag on image"
                        : "Add box"}
                    </button>
                    <button
                      className={`px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded ${
                        editSelectionMode === "ai"
                          ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-black"
                          : "text-gray-900 dark:text-white"
                      } ${
                        editingDisabled ||
                        awaitingRedraw ||
                        (aiStats?.boxes?.length ?? 0) === 0
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                      onClick={() => {
                        if (
                          editingDisabled ||
                          awaitingRedraw ||
                          (aiStats?.boxes?.length ?? 0) === 0
                        )
                          return;
                        if (editSelectionMode === "ai") {
                          setEditSelectionMode(null);
                        } else {
                          setIsDrawMode(false);
                          setDrawTarget(null);
                          setEditSelectionMode("ai");
                          setAwaitingRedraw(false);
                        }
                      }}
                      disabled={
                        editingDisabled ||
                        awaitingRedraw ||
                        (aiStats?.boxes?.length ?? 0) === 0
                      }
                    >
                      {editSelectionMode === "ai" ? "Cancel edit" : "Edit box"}
                    </button>
                    {isDrawMode &&
                      (drawTarget === "ai" || drawTarget === "ai-edit") && (
                      <button
                        className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 custombutton rounded "
                        onClick={() => {
                          const editingActive = drawTarget === "ai-edit";
                          setIsDrawMode(false);
                          setDrawTarget(null);
                          if (editingActive) {
                            setAwaitingRedraw(false);
                            if (editOriginalRect) {
                              setPendingRect(editOriginalRect);
                              setModalMode("edit");
                              setShowFaultModal(true);
                            } else {
                              setPendingRect(null);
                            }
                          } else {
                            setPendingRect(null);
                          }
                        }}
                      >
                        Cancel drawing
                      </button>
                    )}
                  </div>
                  {editSelectionMode === "ai" &&
                    !awaitingRedraw &&
                    (aiStats?.boxes?.length ?? 0) > 0 && (
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                      Click a box on the image to edit it.
                    </p>
                  )}
                  {awaitingRedraw && editSource === "ai" && (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                      Draw the replacement box on the image to continue editing.
                    </p>
                  )}
                </div>
              ) : (
                <div className="w-full h-56 flex items-center justify-center border border-gray-200 dark:border-gray-700 rounded text-gray-400">
                  Run analysis to see overlay
                </div>
              )}
              {aiStats && (aiStats.boxInfo?.length ?? 0) > 0 && (
                <ol className="mt-2 text-xs grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                  {aiStats.boxInfo!.map((bi, i) => {
                    const fault = toDisplayLabel(
                      canonicalizeFault(bi.boxFault || "none")
                    );
                    const sev =
                      typeof bi.severity === "number" ? bi.severity : undefined;
                    const sevPct =
                      typeof sev === "number"
                        ? Math.round(sev * 100)
                        : undefined;
                    const commentText =
                      typeof bi.comment === "string" && bi.comment.trim().length > 0
                        ? bi.comment.trim()
                        : null;
                    const annotatedByRaw = (bi as { annotatedBy?: string | null }).annotatedBy;
                    const annotator =
                      typeof annotatedByRaw === "string" && annotatedByRaw.trim().length > 0
                        ? annotatedByRaw.trim()
                        : "AI";
                    return (
                      <li
                        key={`ai-legend-${i}`}
                        className="flex items-center gap-2"
                      >
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full font-semibold">
                          {i + 1}
                        </span>
                        <div className="flex flex-col text-left">
                          <span>
                            {fault}
                            {` · Annotated by ${annotator}`}
                            {sevPct !== undefined ? ` · Severity ${sevPct}%` : ""}
                          </span>
                          {commentText && (
                            <span className="text-[11px] text-gray-500 dark:text-gray-400">
                              Comment: {commentText}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
              {typeof aiStats?.prob === "number" && (
                <div className="mt-2 text-xs">
                  <span className="font-semibold">Confidence:</span>{" "}
                  {aiStats.prob.toFixed(2)}
                </div>
              )}
              {typeof aiStats?.overallSeverity === "number" && (
                <div className="mt-2 text-xs text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">Overall severity:</span>{" "}
                  {Math.round((aiStats.overallSeverity ?? 0) * 100)}%{" "}
                  {aiStats.overallSeverityLabel
                    ? `(${aiStats.overallSeverityLabel})`
                    : ""}
                </div>
              )}
              {!aiStats && storedImageUrl && (
                <div className="mt-4">
                  <h5 className="font-semibold mb-2 ">Stored analysis</h5>
                  <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
                    {historySnapshots.length > 0 && (
                      <>
                        <label className="font-semibold">
                          Version
                        </label>
                        <select
                          className="details-panel border border-gray-300 dark:border-gray-600 rounded px-2 py-1"
                          value={
                            selectedSnapshotIndex === null
                              ? "current"
                              : String(selectedSnapshotIndex)
                          }
                          onChange={(event) => handleHistorySelect(event.target.value)}
                        >
                          <option value="current">{currentVersionLabel}</option>
                          {historyOptionsDesc.map(({ index, label }) => (
                            <option key={index} value={index}>
                              {label}
                            </option>
                          ))}
                        </select>
                        {selectedSnapshotIndex !== null && (
                          <button
                            type="button"
                            className="details-panel inline-flex items-center gap-1 rounded border border-gray-300 hover:bg-gray-50 px-2 py-1"
                            onClick={() => setSelectedSnapshotIndex(null)}
                          >
                            Return to latest
                          </button>
                        )}
                      </>
                    )}
                    <button
                      type="button"
                      className={`details-panel inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 transition-colors ${
                        editingDisabled || !hasSessionChanges
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-gray-50"
                      }`}
                      onClick={resetSessionChanges}
                      disabled={editingDisabled || !hasSessionChanges}
                    >
                      Reset boxes
                    </button>
                  </div>
                  {selectedSnapshotIndex !== null && (
                    <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">
                      Viewing archived snapshot from {" "}
                      {formatTimestamp(displaySnapshot?.timestamp) || "unknown time"}
                      ; editing disabled.
                    </p>
                  )}
                  {visibleBoxInfo.length > 0 ? (
                    <div className="overscroll-none overflow-hidden">
                      {(visibleFaultSummary.length > 0 ||
                        visibleBoxCount === 0) && (
                        <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
                          {visibleFaultSummary.map(({ fault, label, count }) => (
                            <span
                              key={fault}
                              className="details-panel inline-flex items-center gap-1 rounded-full border border-gray-300 pl-2 pr-2"
                            >
                              <span className="font-semibold">{count}</span>
                              <span>{label}</span>
                            </span>
                          ))}
                          {visibleBoxCount === 0 &&
                            visibleBoxInfo.length > 0 && (
                              <button
                                type="button"
                                className="details-panel ml-auto inline-flex items-center gap-1 rounded border border-gray-300 hover:bg-gray-50"
                                onClick={() =>
                                  setOverlayToggles({
                                    looseJoint: true,
                                    pointOverload: true,
                                    wireOverload: true,
                                  })
                                }
                              >
                                Show all overlays
                              </button>
                            )}
                        </div>
                      )}
                      <OverlayedThermal
                        imageUrl={storedImageUrl as string}
                        // No persisted dims; component infers automatically from the image element
                        // Boxes are stored as natural image pixel coordinates (same space as analyze output)
                        boxes={visibleBoxes}
                        boxInfo={visibleBoxInfo.map((bi, idx) => ({
                          ...bi,
                          label: String(idx + 1),
                        }))}
                        toggles={overlayToggles}
                        allowDraw={
                          !editingDisabled &&
                          isDrawMode &&
                          (drawTarget === "stored" || drawTarget === "stored-edit")
                        }
                        onDrawComplete={(rect) => {
                          if (editingDisabled) return;
                          if (drawTarget === "stored-edit") {
                            setPendingRect(rect);
                            setModalMode("edit");
                            setIsDrawMode(false);
                            setDrawTarget(null);
                            setAwaitingRedraw(false);
                            setShowFaultModal(true);
                          } else {
                            setPendingRect(rect);
                            setModalMode("add");
                            setEditIndex(null);
                            setCommentInput("");
                            setShowFaultModal(true);
                            setIsDrawMode(false);
                            setDrawTarget(null);
                          }
                        }}
                        resetKey={`${inspection.id}-stored`}
                        onSelectBox={
                          editingDisabled
                            ? undefined
                            : (
                                selectedIdx,
                                selectedBox,
                                source?: "click" | "button"
                              ) => {
                                if (
                                  source !== "button" &&
                                  editSelectionMode !== "stored"
                                ) {
                                  return;
                                }
                                handleStoredBoxEdit(selectedIdx, selectedBox);
                              }
                        }
                        onRemoveBox={async (idx, box) => {
                          if (editingDisabled) return;
                          if (!inspection.id) return;
                          // determine the box coords to delete, capture before mutating state
                          let matchIdx = idx;
                          let del = box as {x:number;y:number;w:number;h:number} | undefined;
                          if (!del && Array.isArray(storedBoxes)) {
                            if (storedBoxes[idx]) {
                              const b = storedBoxes[idx];
                              del = { x: b[0], y: b[1], w: b[2], h: b[3] };
                            }
                          }
                          if (del && Array.isArray(storedBoxes)) {
                            const found = storedBoxes.findIndex(
                              (b) => b && b.length >= 4 && b[0] === del!.x && b[1] === del!.y && b[2] === del!.w && b[3] === del!.h
                            );
                            if (found >= 0) matchIdx = found;
                          }
                          const newBoxes = Array.isArray(storedBoxes)
                            ? storedBoxes.slice()
                            : [];
                          if (matchIdx >= 0 && matchIdx < newBoxes.length)
                            newBoxes.splice(matchIdx, 1);
                          const newFaults = Array.isArray(storedFaultTypes)
                            ? storedFaultTypes.slice()
                            : [];
                          if (matchIdx >= 0 && matchIdx < newFaults.length)
                            newFaults.splice(matchIdx, 1);
                          const newAnnotatedBy = Array.isArray(storedAnnotatedBy)
                            ? storedAnnotatedBy.slice()
                            : [];
                          if (matchIdx >= 0 && matchIdx < newAnnotatedBy.length)
                            newAnnotatedBy.splice(matchIdx, 1);
                          const newSeverity = Array.isArray(storedSeverity)
                            ? storedSeverity.slice()
                            : [];
                          if (matchIdx >= 0 && matchIdx < newSeverity.length)
                            newSeverity.splice(matchIdx, 1);
                          const newComments = Array.isArray(storedComments)
                            ? storedComments.slice()
                            : [];
                          if (matchIdx >= 0 && matchIdx < newComments.length)
                            newComments.splice(matchIdx, 1);
                          setStoredBoxes(newBoxes);
                          setStoredFaultTypes(newFaults);
                          setStoredAnnotatedBy(newAnnotatedBy);
                          setStoredSeverity(newSeverity);
                          setStoredComments(newComments);
                          // queue the delete if we have coords; also cancel out any pending add for same box
                          if (del) {
                            setPendingDeletes((prev) => {
                              const addIdx = pendingAdds.findIndex((a) => sameBox(a, del!));
                              if (addIdx >= 0) {
                                const na = pendingAdds.slice();
                                na.splice(addIdx, 1);
                                setPendingAdds(na);
                                return prev;
                              }
                              return [...prev, del!];
                            });
                          }
                        }}
                        containerClassName="w-full border rounded overflow-hidden"
                      />
                      {/* Add box button for stored overlay */}
                      <div className="mt-2 flex gap-2">
                        <button
                          className={`px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded custombutton  ${editingDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                          disabled={editingDisabled}
                          onClick={() => {
                            if (editingDisabled) return;
                            setIsDrawMode(true);
                            setDrawTarget("stored");
                          }}
                        >
                          {isDrawMode && drawTarget === "stored"
                            ? "Drawing: click-drag on image"
                            : "Add box"}
                        </button>
                        {isDrawMode &&
                          (drawTarget === "stored" || drawTarget === "stored-edit") && (
                          <button
                            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded custombutton"
                            onClick={() => {
                              const editingActive = drawTarget === "stored-edit";
                              setIsDrawMode(false);
                              setDrawTarget(null);
                              if (editingActive) {
                                setAwaitingRedraw(false);
                                if (editOriginalRect) {
                                  setPendingRect(editOriginalRect);
                                  setModalMode("edit");
                                  setShowFaultModal(true);
                                } else {
                                  setPendingRect(null);
                                }
                              } else {
                                setPendingRect(null);
                              }
                            }}
                          >
                            Cancel drawing
                          </button>
                        )}
                      </div>
                      {awaitingRedraw && editSource === "stored" && (
                        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                          Draw the replacement box on the image to continue editing.
                        </p>
                      )}
                      {visibleBoxInfo.length > 0 && (
                        <ol className="mt-2 text-xs text-gray-700 dark:text-gray-300 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                          {visibleBoxInfo.map((bi, i) => {
                            const who = visibleAnnotatedBy[i] || "user";
                            const label = toDisplayLabel(
                              canonicalizeFault(bi.boxFault || "none")
                            );
                            const sev = visibleSeverity[i];
                            const sevPct =
                              who.toLowerCase() === "ai" && typeof sev === "number"
                                ? Math.round(sev * 100)
                                : undefined;
                            const commentText =
                              typeof bi.comment === "string" && bi.comment.trim().length > 0
                                ? bi.comment.trim()
                                : null;
                            const statusText = formatStatusLabel(
                              (bi as { status?: "added" | "edited" | "deleted" | null }).status ?? null,
                              selectedSnapshotIndex !== null
                            );
                            const createdAtValue =
                              (bi as { createdAt?: string | null }).createdAt ??
                              (visibleCreatedAt[i] ?? null);
                            const createdAtText = formatCreatedAtLabel(createdAtValue);
                            return (
                              <li
                                key={`stored-legend-${i}`}
                                className="flex items-center gap-2"
                              >
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full font-semibold">
                                  {i + 1}
                                </span>
                                <div className="flex flex-col text-left">
                                  <span>
                                    {label}
                                    {` · Annotated by ${who}`}
                                    {sevPct !== undefined
                                      ? ` · Severity ${sevPct}%`
                                      : ""}
                                  </span>
                                  {commentText && (
                                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                      Comment: {commentText}
                                    </span>
                                  )}
                                  {statusText && (
                                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                      {statusText}
                                    </span>
                                  )}
                                  {createdAtText && (
                                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                      Added at {createdAtText}
                                    </span>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No stored bounding boxes found for this inspection.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Reset model confirmation */}
        {showResetModelConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="details-panel bg-white dark:bg-[#111] rounded shadow-lg p-5 w-96">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Reset AI parameters?
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                This will restore all model tuning values to the factory defaults
                and cannot be undone. Continue?
              </p>
              {resetModelError && (
                <div className="mb-3 text-sm text-red-600" role="alert">
                  {resetModelError}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white disabled:opacity-60"
                  onClick={closeResetModelModal}
                  disabled={isResettingModel}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-3 py-1 text-sm rounded bg-red-600 text-white disabled:opacity-60"
                  onClick={handleConfirmResetModel}
                  disabled={isResettingModel}
                >
                  {isResettingModel ? "Resetting…" : "Yes, reset"}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Fault selection modal */}
        {showFaultModal && pendingRect && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="details-panel bg-white dark:bg-[#111] rounded shadow-lg p-4 w-80">
              <h3 className="font-semibold mb-3 text-gray-900">
                {modalMode === "edit" ? "Edit bounding box" : "Add bounding box"}
              </h3>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                Fault type
              </label>
              <select
                className="details-panel w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 mb-4"
                value={faultSelection}
                onChange={(e) => setFaultSelection(e.target.value)}
              >
                <option value="loose joint">Loose joint</option>
                <option value="point overload">Point overload</option>
                <option value="wire overload">Wire overload</option>
                <option value="none">None</option>
              </select>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                Comment (optional)
              </label>
              <textarea
                className="details-panel w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 mb-4 text-sm"
                rows={3}
                placeholder="Add context for this box"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
              />
              {modalMode === "edit" && !awaitingRedraw && (
                <button
                  type="button"
                  className="w-full mb-3 text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-1 text-gray-900 dark:text-white"
                  onClick={requestBoundingBoxRedraw}
                >
                  Redraw bounding box
                </button>
              )}
              <div className="flex justify-end gap-2">
                <button
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white"
                  type="button"
                  onClick={handleModalCancel}
                >
                  Cancel
                </button>
                <button
                  className="px-3 py-1 text-sm rounded bg-black dark:bg-white text-white dark:text-black"
                  type="button"
                  onClick={handleModalSave}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <LoadingScreen
        show={isClosing || isExporting}
        message={
          isExporting
            ? "Preparing export…"
            : tuneModelEnabled
            ? "Tuning AI model…"
            : "Loading inspections…"
        }
      />
      </div>
    </>
  );
};

export default InspectionDetailsPanel;
