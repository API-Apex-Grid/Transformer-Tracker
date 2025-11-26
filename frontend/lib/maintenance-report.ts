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
  logoUrl?: string | null;
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
  const { inspection, maintenance, annotations, imageUrl, logoUrl } = options;
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage();
  const width = page.getWidth();
  const contentWidth = width - margin * 2;
  let cursorY = page.getHeight() - margin;

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const times = await pdfDoc.embedFont(StandardFonts.TimesRoman);

  const ensureSpace = (needed: number) => {
    if (cursorY - needed <= margin) {
      page = pdfDoc.addPage();
      cursorY = page.getHeight() - margin;
    }
  };
  const accent = rgb(0.0, 0.47, 0.75);

  const drawTextLine = (
    text: string,
    size = 11,
    weight: "normal" | "bold" = "normal",
    color = rgb(0, 0, 0),
    x = margin
  ) => {
    ensureSpace(size + lineGap);
    page.drawText(text, {
      x,
      y: cursorY,
      size,
      font: weight === "bold" ? boldFont : font,
      color,
    });
    cursorY -= size + lineGap;
  };

  const drawSectionHeader = (label: string) => {
    const height = 22;
    ensureSpace(height + 8);
    const x = margin;
    const y = cursorY - height + 6;
    page.drawRectangle({ x, y, width: contentWidth, height, color: accent });
    page.drawText(label, { x: x + 8, y: y + 6, size: 11, font: boldFont, color: rgb(1, 1, 1) });
    cursorY = y - 12;
  };
  const drawDivider = (thickness = 1, color = accent) => {
    ensureSpace(thickness + 4);
    const y = cursorY - 4;
    page.drawLine({
      start: { x: margin, y },
      end: { x: margin + contentWidth, y },
      thickness,
      color,
    });
    cursorY = y - 8;
  };

  // content header removed - avoid repeating title/inspection on every page

  const drawFooter = (pageIndex: number, total: number) => {
    const footerY = 28;
    const left = `${inspection.transformerNumber || maintenance.transformerName || "—"}`;
    page.drawText(left, { x: margin, y: footerY, size: 9, font: times, color: rgb(0.4, 0.4, 0.4) });
    const right = `Page ${pageIndex} / ${total}`;
    const textWidth = font.widthOfTextAtSize(right, 9);
    page.drawText(right, { x: margin + contentWidth - textWidth, y: footerY, size: 9, font: times, color: rgb(0.4, 0.4, 0.4) });
  };

  const drawLabeledTable = (pairs: Array<[string, string | number | null | undefined]>) => {
    const rowH = 20;
    const rows = pairs.length;
    const tableH = rows * rowH + 8;
    ensureSpace(tableH + 8);
    const x = margin;
    const y = cursorY;
    const labelW = 160;
    const valueX = x + labelW + 12;
    // light background for table area
    page.drawRectangle({ x, y: y - tableH + 8, width: contentWidth, height: tableH, color: rgb(0.99, 0.99, 0.99) });
    // rows
    for (let i = 0; i < rows; i += 1) {
      const [k, v] = pairs[i];
      const value = v === null || v === undefined || (typeof v === "string" && v.trim().length === 0) ? "—" : String(v);
      const rowY = y - (i * rowH) - 18;
      // divider line
      page.drawLine({ start: { x, y: rowY - 4 }, end: { x: x + contentWidth, y: rowY - 4 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
      page.drawText(k + ":", { x: x + 8, y: rowY - 2, size: 10, font: boldFont, color: rgb(0.12, 0.12, 0.12) });
      page.drawText(value, { x: valueX, y: rowY - 2, size: 10, font, color: rgb(0.15, 0.15, 0.15) });
    }
    cursorY = y - tableH - 6;
  };

  const drawParagraph = (label: string, value?: string | null) => {
    const display = value && value.trim().length > 0 ? value.trim() : "—";
    const lines = wrapLines(display, contentWidth, font, 10);
    drawTextLine(label, 11, "bold");
    lines.forEach((line) => drawTextLine(line, 10));
    cursorY -= 4;
  };

  // header
  // Cover page (title + optional logo) and then header for content pages
  const drawCoverPage = async () => {
    // Draw big title
    const title = "Maintenance Report";
    const titleSize = 28;
    const titleWidth = boldFont.widthOfTextAtSize(title, titleSize);
    page.drawText(title, { x: (width - titleWidth) / 2, y: page.getHeight() - 140, size: titleSize, font: boldFont, color: accent });

    // Logo (optional)
    if (logoUrl) {
      try {
        const logoBytes = await fetchImageBytes(logoUrl);
        const logoImage = await pdfDoc.embedPng(logoBytes);
        const logoW = 120;
        const logoH = (logoImage.height / logoImage.width) * logoW;
        page.drawImage(logoImage, { x: width - margin - logoW, y: page.getHeight() - margin - logoH + 10, width: logoW, height: logoH });
      } catch (e) {
        // ignore logo errors
      }
    }

    // Small cover summary: only inspection id (details are in tables below)
    const small = 11;
    const inspectionLineY = page.getHeight() - 180;
    page.drawText(`Inspection: ${inspection.inspectionNumber || inspection.id || "—"}`, { x: margin, y: inspectionLineY, size: small, font: boldFont, color: rgb(0.12,0.12,0.12) });

    // generation date (left aligned under title, slightly below inspection line)
    const now = new Date();
    const dateLine = `Report generated: ${now.toISOString().split("T")[0]}`;
    const dateY = inspectionLineY - 18;
    page.drawText(dateLine, { x: margin, y: dateY, size: 10, font, color: rgb(0.35,0.35,0.35) });

    // continue on the same page: position cursor below the cover block
    cursorY = dateY - 50;
  };

  await drawCoverPage();

  // content header removed to avoid duplicate title

  // Inspection details table
  drawSectionHeader("Inspection Details");
  // add small top padding before first table
  cursorY -= 2;
  drawLabeledTable([
    ["Transformer", inspection.transformerNumber || maintenance.transformerName || "—"],
    ["Branch", inspection.branch || "—"],
    ["Inspected", inspection.inspectedDate || maintenance.inspectionDate || "—"],
    ["Status", inspection.status || maintenance.status || "—"],
    ["Uploaded by", inspection.uploadedBy || inspection.imageUploadedBy || "—"],
  ]);
  // spacing between tables
  cursorY -= 12;
  drawSectionHeader("Maintenance Record");
  cursorY -= 2;
  drawLabeledTable([
    ["Timestamp", maintenance.timestamp || "—"],
    ["Inspector", maintenance.inspectorName || "—"],
    ["Record status", maintenance.status || inspection.status || "—"],
    ["Voltage (V)", formatNumber(maintenance.voltage)],
    ["Current (A)", formatNumber(maintenance.current)],
    ["Efficiency", formatNumber(maintenance.efficiency)],
  ]);
  // spacing before recommendations
  cursorY -= 18;
  // Recommendation and remarks shown after tables
  drawTextLine("Recommendation", 11, "bold");
  drawParagraph("", maintenance.recommendation);
  cursorY -= 8;
  drawTextLine("Remarks", 11, "bold");
  drawParagraph("", maintenance.remarks);

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
        cursorY -= targetHeight + 36;
      }
    } catch (error) {
      console.error("Failed to attach thermal image", error);
      drawTextLine("Thermal image unavailable", 10, "bold", rgb(0.8, 0.2, 0.2));
    }
  }

  // Annotations (styled table + legend)
  drawSectionHeader("Annotations");
  if (annotationSummaries.length === 0) {
    drawTextLine("No annotations captured", 10);
  } else {
    // legend (fault colors)
    const uniqueFaults = Array.from(new Set((annotations?.faults ?? []).map((f) => (f || "none").toLowerCase())));
    if (uniqueFaults.length > 0) {
      // Layout legend items left-to-right and wrap to next line when needed
      const labelSize = 10;
      const iconSize = 10;
      const gap = 8; // space between icon and label
      const itemGap = 18; // space between items
      // Measure and build items
      const items = uniqueFaults.map((fault) => {
        const label = normalizeLabel(fault);
        const labelWidth = font.widthOfTextAtSize(label, labelSize);
        return { fault, label, labelWidth };
      });
      // compute layout into rows
      const rows: Array<Array<{ fault: string; label: string; labelWidth: number }>> = [[]];
      let currentRowWidth = 0;
      const maxWidth = contentWidth;
      // reserve space for "Legend:" text on the left
      const legendTitleWidth = font.widthOfTextAtSize("Legend:", labelSize) + 10;
      currentRowWidth = legendTitleWidth + itemGap;
      items.forEach((it) => {
        const itemWidth = iconSize + gap + it.labelWidth + itemGap;
        if (currentRowWidth + itemWidth > maxWidth) {
          rows.push([]);
          currentRowWidth = 0;
        }
        rows[rows.length - 1].push(it);
        currentRowWidth += itemWidth;
      });
      const neededHeight = 14 + rows.length * 14;
      ensureSpace(neededHeight + 6);
      let legendY = cursorY;
      // draw title
      page.drawText("Legend:", { x: margin, y: legendY, size: labelSize, font: boldFont });
      // draw rows
      let rowY = legendY - 14;
      for (let r = 0; r < rows.length; r += 1) {
        let x = margin + legendTitleWidth;
        const row = rows[r];
        for (let i = 0; i < row.length; i += 1) {
          const it = row[i];
          const colorHex = FAULT_COLORS[it.fault] ?? FAULT_COLORS.none;
          const rr = parseInt(colorHex.slice(1, 3), 16) / 255;
          const gg = parseInt(colorHex.slice(3, 5), 16) / 255;
          const bb = parseInt(colorHex.slice(5, 7), 16) / 255;
          page.drawRectangle({ x, y: rowY - 6, width: iconSize, height: iconSize, color: rgb(rr, gg, bb) });
          page.drawText(it.label, { x: x + iconSize + gap, y: rowY - 2, size: labelSize, font });
          x += iconSize + gap + it.labelWidth + itemGap;
        }
        rowY -= 14;
      }
      cursorY = rowY - 8;
    }

    // table layout columns
    const tableX = margin;
    const idxW = 24;
    const faultW = 180;
    const annotW = 120;
    const sevW = 60;
    const commentX = tableX + idxW + faultW + annotW + sevW + 20;
    const tableW = contentWidth;
    // header row
    ensureSpace(18);
    page.drawRectangle({ x: tableX, y: cursorY - 14, width: tableW, height: 16, color: rgb(0.95, 0.95, 0.95) });
    page.drawText("#", { x: tableX + 6, y: cursorY - 10, size: 10, font: boldFont });
    page.drawText("Fault", { x: tableX + idxW + 6, y: cursorY - 10, size: 10, font: boldFont });
    page.drawText("Annotator", { x: tableX + idxW + faultW + 6, y: cursorY - 10, size: 10, font: boldFont });
    page.drawText("Severity", { x: tableX + idxW + faultW + annotW + 6, y: cursorY - 10, size: 10, font: boldFont });
    cursorY -= 22;

    annotationSummaries.forEach((entry, i) => {
      const baseY = cursorY;
      const commentWidth = Math.max(80, contentWidth - (commentX - tableX) - 12);
      const commentLines = entry.comment ? wrapLines(entry.comment, commentWidth, font, 9) : [];
      const rowH = Math.max(18, 10 + commentLines.length * 10);
      ensureSpace(rowH + 6);
      // alternating background
      if (i % 2 === 0) {
        page.drawRectangle({ x: tableX, y: baseY - rowH + 6, width: tableW, height: rowH, color: rgb(0.99, 0.99, 0.99) });
      }
      // colored bullet
      const faultKey = entry.fault.toLowerCase();
      const colorHex = FAULT_COLORS[faultKey] ?? FAULT_COLORS.none;
      const r = parseInt(colorHex.slice(1, 3), 16) / 255;
      const g = parseInt(colorHex.slice(3, 5), 16) / 255;
      const b = parseInt(colorHex.slice(5, 7), 16) / 255;
      page.drawCircle({ x: tableX + 10, y: baseY - 6, size: 4, color: rgb(r, g, b) });
      page.drawText(String(entry.index), { x: tableX + 16, y: baseY - 10, size: 10, font });
      page.drawText(entry.fault, { x: tableX + idxW + 6, y: baseY - 10, size: 10, font });
      page.drawText(entry.annotator, { x: tableX + idxW + faultW + 6, y: baseY - 10, size: 10, font });
      page.drawText(entry.severity ?? "—", { x: tableX + idxW + faultW + annotW + 6, y: baseY - 10, size: 10, font });
      // comments
      if (commentLines.length) {
        let cy = baseY - 10 - 12;
        commentLines.forEach((line) => {
          page.drawText(line, { x: commentX, y: cy, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
          cy -= 10;
        });
      }
      cursorY -= rowH + 6;
    });
  }

  // add footers to all pages
  const pages = pdfDoc.getPages();
  pages.forEach((p, i) => {
    const pageIndex = i + 1;
    const total = pages.length;
    const footerY = 28;
    const left = `${inspection.transformerNumber || maintenance.transformerName || "—"}`;
    p.drawText(left, { x: margin, y: footerY, size: 9, font: times, color: rgb(0.45, 0.45, 0.45) });
    const right = `Page ${pageIndex} / ${total}`;
    const textWidth = font.widthOfTextAtSize(right, 9);
    p.drawText(right, { x: margin + contentWidth - textWidth, y: footerY, size: 9, font: times, color: rgb(0.45, 0.45, 0.45) });
  });

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
