import { Inspection } from "@/types/inspection";

const toFinite = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

export const canonicalizeFault = (fault: string | null | undefined): string => {
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

export const toDisplayLabel = (fault: string): string => {
  if (!fault || fault === "none") return "No classification";
  return fault
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export const parseBoundingBoxes = (
  raw: Inspection["boundingBoxes"]
): number[][] => {
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

export const parseFaultTypes = (
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
      ...Array.from({ length: expectedLength - normalized.length }, () => "none")
    );
  }
  return normalized.slice(0, expectedLength);
};

export const parseAnnotatedBy = (
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

export const parseSeverities = (
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
