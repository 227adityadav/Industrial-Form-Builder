import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { parseSubmissionGrids } from "@/lib/submission-grids";
import type { SubmissionRecord } from "@/types/submission";
import { normalizeSubmissionStatus } from "@/types/submission";
import { isUploadedFileFieldValue } from "@/types/file-field";
import { isDigitalSignatureValue } from "@/types/signature";
import type { FieldsSection, FooterField, FormSchema, GridColumnNode, InputType, TopField } from "@/types/form-schema";

function safeFilenamePart(s: string): string {
  const t = s.trim().replace(/[^a-zA-Z0-9._-]+/g, "_");
  return t.length > 0 ? t.slice(0, 80) : "submission";
}

export function submissionPdfFilename(templateName: string, submissionId: string): string {
  const base = safeFilenamePart(templateName);
  const shortId = submissionId.replace(/-/g, "").slice(0, 8);
  return `${base}-${shortId}.pdf`;
}

function formatTopValue(field: TopField, raw: unknown): string {
  if (raw == null) return "";
  if (field.inputType === "toggle") return raw === true ? "Yes" : "No";
  if (field.inputType === "signature") {
    if (isDigitalSignatureValue(raw)) {
      return `Digital signature · ${new Date(raw.signedAt).toLocaleString()}`;
    }
    return "";
  }
  if (field.inputType === "file") {
    if (isUploadedFileFieldValue(raw)) {
      return `Attachment: ${raw.fileName} · ${new Date(raw.uploadedAt).toLocaleString()}`;
    }
    return "";
  }
  if (field.inputType === "select") {
    const v = String(raw);
    const opt = field.options?.find((o) => o.value === v);
    return opt?.label ?? v;
  }
  return String(raw);
}

function formatFooterValue(field: FooterField, value: unknown): string {
  if (field.kind === "verification") {
    if (field.inputType === "toggle") {
      if (value === true) return "Yes";
      if (value === false) return "No";
      return "";
    }
    if (field.inputType === "select") {
      const s = value == null ? "" : String(value);
      const opt = field.options?.find((o) => o.value === s);
      return opt?.label ?? s;
    }
    return value == null ? "" : String(value);
  }
  if (field.kind === "timestamp") {
    return value == null ? "" : String(value);
  }
  return value == null ? "" : String(value);
}

function isLeafColumn(col: GridColumnNode): boolean {
  return !col.children?.length;
}

function collectLeafColumns(
  cols: GridColumnNode[],
  prefix = "",
  sep = " › "
): { id: string; header: string; inputType: InputType }[] {
  const out: { id: string; header: string; inputType: InputType }[] = [];
  for (const c of cols) {
    const path = prefix ? `${prefix}${sep}${c.label}` : c.label;
    if (isLeafColumn(c)) {
      out.push({ id: c.id, header: path, inputType: c.leaf?.inputType ?? "text" });
    } else {
      out.push(...collectLeafColumns(c.children ?? [], path, sep));
    }
  }
  return out;
}

function formatGridCell(inputType: InputType, raw: unknown): string {
  if (raw == null || raw === "") return "";
  if (inputType === "toggle") return raw === true ? "Yes" : raw === false ? "No" : "";
  return String(raw);
}

const SIGNATURE_IMG_W_MM = 65;
const SIGNATURE_IMG_H_MM = 20;

/** Returns Y position below the image (or below error text). */
function drawDataUrlImage(
  doc: jsPDF,
  dataUrl: string,
  x: number,
  y: number,
  w: number,
  h: number
): number {
  const m = dataUrl.trim().match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
  if (!m?.[2]) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text("(signature image unavailable)", x, y + 4);
    doc.setFont("helvetica", "normal");
    return y + 8;
  }
  const fmt = m[1].toLowerCase() === "png" ? "PNG" : "JPEG";
  try {
    doc.addImage(m[2], fmt, x, y, w, h);
    return y + h + 2;
  } catch {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text("(could not embed signature image)", x, y + 4);
    doc.setFont("helvetica", "normal");
    return y + 8;
  }
}

function ensureVerticalSpace(doc: jsPDF, y: number, neededMm: number, margin: number, pageH: number): number {
  if (y + neededMm > pageH - margin) {
    doc.addPage();
    return margin + 4;
  }
  return y;
}

function isFullWidthInfoField(f: TopField, raw: unknown): boolean {
  if (f.inputType === "signature" && isDigitalSignatureValue(raw)) return true;
  if (f.inputType === "file" && isUploadedFileFieldValue(raw)) return true;
  return false;
}

/** Rough height (mm) for a simple text column field (label + value). */
function estimateNarrowInfoFieldHeight(doc: jsPDF, f: TopField, raw: unknown, colW: number): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const val = formatTopValue(f, raw) || "—";
  const lines = doc.splitTextToSize(val, colW);
  return 5 + 4 + Math.max(1, lines.length) * 4.2 + 3;
}

/**
 * Draws one top "info" field in a column; returns Y just below the field (incl. trailing gap).
 * When allowPageBreak is false, the caller must ensure the block fits on the current page from yStart.
 */
function drawNarrowInfoField(
  doc: jsPDF,
  f: TopField,
  raw: unknown,
  x: number,
  colW: number,
  margin: number,
  pageH: number,
  yStart: number,
  allowPageBreak: boolean
): number {
  let y = yStart;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(f.label, x, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const val = formatTopValue(f, raw) || "—";
  const lines = doc.splitTextToSize(val, colW);
  let yy = y;
  for (const line of lines) {
    if (allowPageBreak) {
      yy = ensureVerticalSpace(doc, yy, 6, margin, pageH);
    }
    doc.text(line, x, yy);
    yy += 4.2;
  }
  return yy + 3;
}

/**
 * Draws signature / file field full width (images and non-embedded docs).
 * Returns Y below the block.
 */
function drawFullWidthInfoField(
  doc: jsPDF,
  f: TopField,
  raw: unknown,
  margin: number,
  maxTextW: number,
  pageH: number,
  yStart: number
): number {
  let y = yStart;
  const imageLikeBlock =
    (f.inputType === "signature" && isDigitalSignatureValue(raw)) ||
    (f.inputType === "file" &&
      isUploadedFileFieldValue(raw) &&
      raw.mimeType.startsWith("image/"));
  const sigBlock = imageLikeBlock ? 6 + SIGNATURE_IMG_H_MM + 14 : 18;
  y = ensureVerticalSpace(doc, y, sigBlock, margin, pageH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(f.label, margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  if (f.inputType === "signature" && isDigitalSignatureValue(raw)) {
    doc.setFontSize(8);
    doc.setTextColor(82, 82, 91);
    doc.text(`Signed: ${new Date(raw.signedAt).toLocaleString()}`, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 4;
    y = drawDataUrlImage(doc, raw.imageDataUrl, margin, y, SIGNATURE_IMG_W_MM, SIGNATURE_IMG_H_MM);
    y += 4;
  } else if (f.inputType === "file" && isUploadedFileFieldValue(raw)) {
    doc.setFontSize(8);
    doc.setTextColor(82, 82, 91);
    doc.text(`Uploaded: ${new Date(raw.uploadedAt).toLocaleString()} · ${raw.fileName}`, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 4;
    if (raw.mimeType.startsWith("image/")) {
      y = drawDataUrlImage(doc, raw.dataUrl, margin, y, SIGNATURE_IMG_W_MM, SIGNATURE_IMG_H_MM);
    } else {
      doc.setFontSize(9);
      const note = `Document (${raw.mimeType}) — see filename above; binary not embedded in PDF.`;
      const lines = doc.splitTextToSize(note, maxTextW);
      let yy = y;
      for (const line of lines) {
        yy = ensureVerticalSpace(doc, yy, 6, margin, pageH);
        doc.text(line, margin, yy);
        yy += 4.2;
      }
      y = yy;
    }
    y += 4;
  }
  return y;
}

type JsPdfWithTable = jsPDF & { lastAutoTable?: { finalY: number } };

export function buildSubmissionPdfBytes(submission: SubmissionRecord, template: FormSchema): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const maxTextW = pageW - margin * 2;

  let y = 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(template.name, margin, y, { maxWidth: maxTextW });
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const status = normalizeSubmissionStatus(submission);
  const metaLines = [
    `Operator: ${submission.username ?? "unknown"}`,
    `Status: ${status === "ongoing" ? "Ongoing" : "Final"}`,
    `Submitted: ${new Date(submission.submittedAt).toLocaleString()}`,
    `Updated: ${new Date(submission.updatedAt ?? submission.submittedAt).toLocaleString()}`,
  ];
  for (const line of metaLines) {
    doc.text(line, margin, y, { maxWidth: maxTextW });
    y += 5;
  }
  y += 4;

  const gridBySection = parseSubmissionGrids(submission.grid, template);

  const addSectionTitle = (title: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    y += 6;
  };

  for (const section of template.sections) {
    if (section.kind === "fields") {
      if (section.revealButtonId) continue;
      const title = section.title?.trim() || "Info fields";
      addSectionTitle(title);
      if (section.fields.length === 0) {
        y = ensureVerticalSpace(doc, y, 10, margin, pageH);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("No fields in this block.", margin, y);
        y += 8;
        continue;
      }

      const colGap = 4;
      const colW = (maxTextW - colGap) / 2;
      const xLeft = margin;
      const xRight = margin + colW + colGap;
      const usablePageH = pageH - 2 * margin;

      type PendingLeft = { rowY: number; bottomY: number; page: number };
      let pendingLeft: PendingLeft | null = null;

      const flushPendingLeft = () => {
        if (pendingLeft) {
          doc.setPage(pendingLeft.page);
          y = pendingLeft.bottomY;
          pendingLeft = null;
        }
      };

      for (const f of section.fields) {
        const raw = submission.top[f.id];

        if (isFullWidthInfoField(f, raw)) {
          flushPendingLeft();
          y = drawFullWidthInfoField(doc, f, raw, margin, maxTextW, pageH, y);
          continue;
        }

        const est = estimateNarrowInfoFieldHeight(doc, f, raw, colW);
        if (est > usablePageH) {
          flushPendingLeft();
          const estWide = estimateNarrowInfoFieldHeight(doc, f, raw, maxTextW);
          y = ensureVerticalSpace(doc, y, Math.min(estWide, usablePageH), margin, pageH);
          y = drawNarrowInfoField(doc, f, raw, margin, maxTextW, margin, pageH, y, true);
          continue;
        }

        if (pendingLeft === null) {
          y = ensureVerticalSpace(doc, y, est, margin, pageH);
          const rowY = y;
          const pageBefore = doc.getCurrentPageInfo().pageNumber;
          const bottomY = drawNarrowInfoField(doc, f, raw, xLeft, colW, margin, pageH, rowY, false);
          const pageAfter = doc.getCurrentPageInfo().pageNumber;
          if (pageAfter !== pageBefore) {
            pendingLeft = null;
            y = bottomY;
          } else {
            pendingLeft = { rowY, bottomY: bottomY, page: pageBefore };
          }
        } else {
          const { rowY, bottomY: leftBottom, page: rowPage } = pendingLeft;
          if (rowY + est > pageH - margin - 2) {
            doc.setPage(rowPage);
            y = leftBottom;
            pendingLeft = null;
            y = ensureVerticalSpace(doc, y, est, margin, pageH);
            const rowY2 = y;
            const p0 = doc.getCurrentPageInfo().pageNumber;
            const b2 = drawNarrowInfoField(doc, f, raw, xLeft, colW, margin, pageH, rowY2, false);
            const p1 = doc.getCurrentPageInfo().pageNumber;
            if (p1 !== p0) {
              pendingLeft = null;
              y = b2;
            } else {
              pendingLeft = { rowY: rowY2, bottomY: b2, page: p0 };
            }
          } else {
            doc.setPage(rowPage);
            const rightBottom = drawNarrowInfoField(doc, f, raw, xRight, colW, margin, pageH, rowY, false);
            doc.setPage(rowPage);
            y = Math.max(leftBottom, rightBottom);
            pendingLeft = null;
          }
        }
      }
      flushPendingLeft();
      y += 4;
      continue;
    }

    if (section.kind !== "grid") {
      continue;
    }

    if (section.revealButtonId) continue;

    const gridSection = section;
    const title = gridSection.title?.trim() || "Grid";
    addSectionTitle(title);
    const leaves = collectLeafColumns(gridSection.grid.columns);
    const data = gridBySection[section.id] ?? [];
    if (leaves.length === 0) {
      doc.text("No columns configured.", margin, y);
      y += 8;
      continue;
    }
    const head = [leaves.map((l) => l.header)];
    const body =
      data.length > 0
        ? data.map((row) => leaves.map((l) => formatGridCell(l.inputType, row[l.id])))
        : [leaves.map(() => "")];
    autoTable(doc, {
      startY: y,
      head,
      body,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 1.2, overflow: "linebreak" },
      headStyles: { fillColor: [244, 244, 245], textColor: 40, fontStyle: "bold" },
      margin: { left: margin, right: margin },
      tableWidth: maxTextW,
    });
    y = ((doc as JsPdfWithTable).lastAutoTable?.finalY ?? y) + 8;
  }

  for (const fill of submission.revealFills ?? []) {
    const btn = template.revealButtons?.find((b) => b.id === fill.revealButtonId);
    const when = fill.filledAt
      ? `Filled ${new Date(fill.filledAt).toLocaleString()}`
      : `Opened ${new Date(fill.openedAt).toLocaleString()}`;
    addSectionTitle(`${btn?.label ?? "Reveal section"} (${when})`);
    const topRec = fill.top ?? {};
    const fillGrids = parseSubmissionGrids(fill.grid, template);

    for (const section of template.sections) {
      if (section.kind === "fields" && section.revealButtonId === fill.revealButtonId) {
        const fs = section as FieldsSection;
        const title = fs.title?.trim() || "Info fields";
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        y = ensureVerticalSpace(doc, y, 8, margin, pageH);
        doc.text(title, margin, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        if (fs.fields.length === 0) {
          doc.text("No fields in this block.", margin, y);
          y += 8;
          continue;
        }
        const rows = fs.fields.map((f) => [f.label, formatTopValue(f, topRec[f.id]) || "—"]);
        y = ensureVerticalSpace(doc, y, 16, margin, pageH);
        autoTable(doc, {
          startY: y,
          head: [["Field", "Value"]],
          body: rows,
          theme: "grid",
          styles: { fontSize: 9, cellPadding: 1.2, overflow: "linebreak" },
          headStyles: { fillColor: [236, 253, 245], textColor: 20, fontStyle: "bold" },
          margin: { left: margin, right: margin },
          tableWidth: maxTextW,
        });
        y = ((doc as JsPdfWithTable).lastAutoTable?.finalY ?? y) + 8;
      }

      if (section.kind === "grid" && section.revealButtonId === fill.revealButtonId) {
        const gridSection = section;
        const title = gridSection.title?.trim() || "Grid";
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        y = ensureVerticalSpace(doc, y, 8, margin, pageH);
        doc.text(title, margin, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        const leaves = collectLeafColumns(gridSection.grid.columns);
        const data = fillGrids[section.id] ?? [];
        if (leaves.length === 0) {
          doc.text("No columns configured.", margin, y);
          y += 8;
          continue;
        }
        const head = [leaves.map((l) => l.header)];
        const body =
          data.length > 0
            ? data.map((row) => leaves.map((l) => formatGridCell(l.inputType, row[l.id])))
            : [leaves.map(() => "")];
        autoTable(doc, {
          startY: y,
          head,
          body,
          theme: "grid",
          styles: { fontSize: 8, cellPadding: 1.2, overflow: "linebreak" },
          headStyles: { fillColor: [236, 253, 245], textColor: 20, fontStyle: "bold" },
          margin: { left: margin, right: margin },
          tableWidth: maxTextW,
        });
        y = ((doc as JsPdfWithTable).lastAutoTable?.finalY ?? y) + 8;
      }
    }
  }

  addSectionTitle("Footer / workflow");
  const footerRows =
    template.footer.fields.length === 0
      ? [["—", "No footer fields configured."]]
      : template.footer.fields.map((f) => [f.label, formatFooterValue(f, submission.footer[f.id])]);
  autoTable(doc, {
    startY: y,
    head: [["Field", "Value"]],
    body: footerRows,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 1.5, overflow: "linebreak" },
    headStyles: { fillColor: [244, 244, 245], textColor: 40, fontStyle: "bold" },
    margin: { left: margin, right: margin },
    tableWidth: maxTextW,
  });

  const out = doc.output("arraybuffer");
  return new Uint8Array(out);
}
