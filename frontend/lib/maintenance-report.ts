import type { Inspection } from "@/types/inspection";
import type { MaintenanceRecord } from "@/types/maintenance-record";

export type AnnotationPayload = {
  boxes?: number[][] | null;
  faults?: (string | null | undefined)[] | null;
  annotatedBy?: (string | null | undefined)[] | null;
  severity?: (number | null | undefined)[] | null;
  comments?: (string | null | undefined)[] | null;
};

export interface MaintenanceReportOptions {
  inspection: Inspection;
  maintenance: MaintenanceRecord;
  annotations?: AnnotationPayload;
  imageUrl?: string | null;
}

type AnnotationSummary = {
  index: number;
  fault: string;
  annotator: string;
  severity: string | null;
  comment: string | null;
};

const FAULT_COLORS: Record<string, string> = {
  "loose joint": "#ef4444",
  "point overload": "#f97316",
  "wire overload": "#10b981",
  none: "#3b82f6",
};

const margin = 40;
const lineGap = 6;

const formatNumber = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return String(value);
};

const normalizeLabel = (fault?: string | null | undefined) => {
  if (!fault) return "None";
  const trimmed = fault.trim().toLowerCase();
  if (trimmed === "loose joint") return "Loose joint";
  if (trimmed === "point overload") return "Point overload";
  if (trimmed === "wire overload") return "Wire overload";
  return fault;
};

const looksNormalized = (boxes: number[][]): boolean => {
  if (!boxes.length) return false;
  return boxes.every((box) =>
    box.length >= 4 &&
    box.slice(0, 4).every((value) => value >= 0 && value <= 1.05)
  );
};

const denormalizeBoxes = (boxes: number[][], width: number, height: number): number[][] => {
  if (!boxes.length) return [];
  const sanitize = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);
  if (!looksNormalized(boxes)) {
    return boxes.map((box) => {
      const [x, y, w, h] = box.slice(0, 4).map((value) => Number(value));
      return [sanitize(x, 0), sanitize(y, 0), sanitize(w, 0), sanitize(h, 0)];
    });
  }
  return boxes.map((box) => {
    const [x, y, w, h] = box.slice(0, 4).map((value) => Number(value));
    return [
      sanitize(x, 0) * width,
      sanitize(y, 0) * height,
      sanitize(w, 0) * width,
      sanitize(h, 0) * height,
    ];
  });
};

const wrapLines = (
  text: string,
  maxWidth: number,
  font: import("pdf-lib").PDFFont,
  size: number
): string[] => {
  const rows: string[] = [];
  const paragraphs = text.split(/\r?\n/);
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      rows.push("");
      continue;
    }
    let line = words[0];
    for (let i = 1; i < words.length; i += 1) {
      const candidate = `${line} ${words[i]}`;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        rows.push(line);
        line = words[i];
      }
    }
    rows.push(line);
  }
  return rows;
};

const buildAnnotationSummaries = (payload?: AnnotationPayload): AnnotationSummary[] => {
  const boxes = payload?.boxes ?? [];
  const faults = payload?.faults ?? [];
  const annotatedBy = payload?.annotatedBy ?? [];
  const severity = payload?.severity ?? [];
  const comments = payload?.comments ?? [];
  const length = Math.max(
    boxes.length,
    faults.length,
    annotatedBy.length,
    severity.length,
    comments.length
  );
  if (length === 0) return [];

  return Array.from({ length }, (_, index) => {
    const fault = normalizeLabel(faults[index] ?? "none");
    const annotatorRaw = annotatedBy[index];
    const annotator = annotatorRaw && annotatorRaw.trim().length > 0 ? annotatorRaw.trim() : "user";
    const sevValue = severity[index];
    const sevLabel = typeof sevValue === "number" && Number.isFinite(sevValue)
      ? `${Math.round(sevValue > 1 ? sevValue : sevValue * 100)}%`
      : null;
    const comment = comments[index];
    return {
      index: index + 1,
      fault,
      annotator,
      severity: sevLabel,
      comment: comment && comment.trim().length > 0 ? comment.trim() : null,
    };
  });
};

const fetchImageBytes = async (imageUrl: string): Promise<ArrayBuffer> => {
  const response = await fetch(imageUrl, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Failed to load image (${response.status})`);
  }
  return response.arrayBuffer();
};

const drawAnnotatedImage = async (
  imageBytes: ArrayBuffer,
  boxes: number[][],
  faults?: (string | null | undefined)[]
) => {
  if (typeof document === "undefined") return null;
  const blob = new Blob([imageBytes]);
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Unable to decode thermal image"));
      img.src = url;
    });
    const naturalWidth = image.naturalWidth || image.width;
    const naturalHeight = image.naturalHeight || image.height;
    if (naturalWidth <= 0 || naturalHeight <= 0) {
      throw new Error("Thermal image reported zero dimensions");
    }
    const canvas = document.createElement("canvas");
    canvas.width = naturalWidth;
    canvas.height = naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Unable to acquire drawing context");
    }
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const scaledBoxes = denormalizeBoxes(boxes, canvas.width, canvas.height);
    const strokeWidth = Math.max(2, Math.round(canvas.width * 0.0025));
    scaledBoxes.forEach((box, index) => {
      const faultLabel = (faults?.[index] ?? "none").toLowerCase();
      const stroke = FAULT_COLORS[faultLabel] ?? FAULT_COLORS.none;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth;
      ctx.strokeRect(box[0], box[1], box[2], box[3]);
      ctx.fillStyle = stroke;
      ctx.font = `${Math.max(12, strokeWidth * 2)}px sans-serif`;
      ctx.fillText(String(index + 1), box[0] + 4, box[1] + 16);
    });
    return {
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
};

export const downloadMaintenanceReportPdf = async (
  options: MaintenanceReportOptions
): Promise<void> => {
  if (typeof document === "undefined") {
    throw new Error("PDF generation is only available in the browser");
  }
  const { inspection, maintenance, annotations, imageUrl } = options;
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage();
  const width = page.getWidth();
  const contentWidth = width - margin * 2;
  let cursorY = page.getHeight() - margin;

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const ensureSpace = (needed: number) => {
    if (cursorY - needed <= margin) {
      page = pdfDoc.addPage();
      cursorY = page.getHeight() - margin;
    }
  };

  const drawTextLine = (
    text: string,
    size = 11,
    weight: "normal" | "bold" = "normal",
    color = rgb(0, 0, 0)
  ) => {
    ensureSpace(size + lineGap);
    page.drawText(text, {
      x: margin,
      y: cursorY,
      size,
      font: weight === "bold" ? boldFont : font,
      color,
    });
    cursorY -= size + lineGap;
  };

  const drawKeyValue = (label: string, value: string) => {
    drawTextLine(`${label}: ${value}`, 10);
  };

  const drawParagraph = (label: string, value?: string | null) => {
    const display = value && value.trim().length > 0 ? value.trim() : "—";
    const lines = wrapLines(display, contentWidth, font, 10);
    drawTextLine(label, 11, "bold");
    lines.forEach((line) => drawTextLine(line, 10));
  };

  drawTextLine("Maintenance Report", 18, "bold", rgb(0.1, 0.1, 0.1));
  drawTextLine(
    inspection.inspectionNumber
      ? `Inspection ${inspection.inspectionNumber}`
      : `Inspection ${inspection.id ?? "Unknown"}`,
    12
  );

  drawTextLine("Inspection Details", 13, "bold");
  drawKeyValue("Transformer", inspection.transformerNumber || maintenance.transformerName || "—");
  drawKeyValue("Branch", inspection.branch || "—");
  drawKeyValue("Inspected", inspection.inspectedDate || maintenance.inspectionDate || "—");
  drawKeyValue("Maintenance", inspection.maintainanceDate || "—");
  drawKeyValue("Status", inspection.status || maintenance.status || "—");
  drawKeyValue("Uploaded by", inspection.uploadedBy || inspection.imageUploadedBy || "—");

  cursorY -= 4;
  drawTextLine("Maintenance Record", 13, "bold");
  drawKeyValue("Timestamp", maintenance.timestamp || "—");
  drawKeyValue("Inspector", maintenance.inspectorName || "—");
  drawKeyValue("Record status", maintenance.status || inspection.status || "—");
  drawKeyValue("Voltage (V)", formatNumber(maintenance.voltage));
  drawKeyValue("Current (A)", formatNumber(maintenance.current));
  drawKeyValue("Efficiency", formatNumber(maintenance.efficiency));
  drawParagraph("Recommendation", maintenance.recommendation);
  drawParagraph("Remarks", maintenance.remarks);

  const annotationSummaries = buildAnnotationSummaries(annotations);

  if (imageUrl) {
    try {
      const imageBytes = await fetchImageBytes(imageUrl);
      const annotated = await drawAnnotatedImage(
        imageBytes,
        annotations?.boxes ?? [],
        annotations?.faults ?? []
      );
      if (annotated) {
        const imageRef = await pdfDoc.embedPng(annotated.dataUrl);
        const ratio = annotated.height > 0 ? annotated.width / annotated.height : 1;
        const targetWidth = contentWidth;
        const targetHeight = targetWidth / ratio;
        ensureSpace(targetHeight + 20);
        page.drawText("Thermal image", {
          x: margin,
          y: cursorY,
          size: 13,
          font: boldFont,
        });
        cursorY -= 18;
        page.drawImage(imageRef, {
          x: margin,
          y: cursorY - targetHeight,
          width: targetWidth,
          height: targetHeight,
        });
        cursorY -= targetHeight + 12;
      }
    } catch (error) {
      console.error("Failed to attach thermal image", error);
      drawTextLine("Thermal image unavailable", 10, "bold", rgb(0.8, 0.2, 0.2));
    }
  }

  drawTextLine("Annotations", 13, "bold");
  if (annotationSummaries.length === 0) {
    drawTextLine("No annotations captured", 10);
  } else {
    annotationSummaries.forEach((entry) => {
      const headline = `#${entry.index} ${entry.fault} · Annotated by ${entry.annotator}` +
        (entry.severity ? ` · Severity ${entry.severity}` : "");
      drawTextLine(headline, 10, "bold");
      if (entry.comment) {
        const lines = wrapLines(entry.comment, contentWidth, font, 10);
        lines.forEach((line) => drawTextLine(line, 10));
      }
      ensureSpace(4);
      cursorY -= 4;
    });
  }

  const pdfBytes = await pdfDoc.save();
  const byteArray = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([byteArray], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const safeBase = (inspection.inspectionNumber || inspection.id || maintenance.id || "maintenance")
    .replace(/[^a-zA-Z0-9._-]+/g, "_");
  const filename = `${safeBase}_maintenance-report.pdf`;
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
