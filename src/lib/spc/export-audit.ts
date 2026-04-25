import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type { CapabilityResult } from "@/lib/spc/capability";

type JsPdfWithTable = InstanceType<typeof jsPDF> & { lastAutoTable?: { finalY: number } };
import { formatCapability } from "@/lib/spc/capability";

export type SpcAuditHeader = {
  partName: string;
  partNo: string;
  operation: string;
  machineNo: string;
  date: string;
  instrumentName: string;
  target: string;
  upperTolerance: string;
  lowerTolerance: string;
};

export function buildSpcStudyCsv(input: {
  header: SpcAuditHeader;
  numSubgroups: number;
  subgroupSize: number;
  cells: string[][];
  result: CapabilityResult | null;
  computeError: string | null;
}): string {
  const lines: string[] = [];
  lines.push("Process Capability Study (audit export)");
  lines.push(`Part Name,${csvEscape(input.header.partName)}`);
  lines.push(`Part No,${csvEscape(input.header.partNo)}`);
  lines.push(`Operation,${csvEscape(input.header.operation)}`);
  lines.push(`Machine No,${csvEscape(input.header.machineNo)}`);
  lines.push(`Date,${csvEscape(input.header.date)}`);
  lines.push(`Instrument,${csvEscape(input.header.instrumentName)}`);
  lines.push(`Target,${csvEscape(input.header.target)}`);
  lines.push(`USL,${csvEscape(input.header.upperTolerance)}`);
  lines.push(`LSL,${csvEscape(input.header.lowerTolerance)}`);
  lines.push(`Subgroups,${input.numSubgroups}`);
  lines.push(`Subgroup size,${input.subgroupSize}`);
  lines.push("");
  const measHeaders = Array.from({ length: input.subgroupSize }, (_, i) => `M${i + 1}`);
  lines.push(["Subgroup", ...measHeaders, "X̄", "R"].join(","));
  for (let r = 0; r < input.numSubgroups; r++) {
    const row = input.cells[r] ?? [];
    const nums = row.slice(0, input.subgroupSize).map((c) => csvEscape(c.trim()));
    while (nums.length < input.subgroupSize) nums.push("");
    const sg = input.result?.subgroups.find((s) => s.index === r + 1);
    const xbar = sg ? formatCapability(sg.mean, 6) : "";
    const range = sg ? formatCapability(sg.range, 6) : "";
    lines.push([String(r + 1), ...nums, xbar, range].join(","));
  }
  lines.push("");
  if (input.computeError) {
    lines.push(`Error,${csvEscape(input.computeError)}`);
  } else if (input.result) {
    lines.push(`Grand mean (X̄̄),${formatCapability(input.result.grandMean, 6)}`);
    lines.push(`Average range (R̄),${formatCapability(input.result.averageRange, 6)}`);
    lines.push(`d₂,${formatCapability(input.result.d2, 4)}`);
    lines.push(`σ (R̄/d₂),${formatCapability(input.result.sigma, 6)}`);
    lines.push(`Cp,${formatCapability(input.result.cp, 4)}`);
    lines.push(`Cpk,${formatCapability(input.result.cpk, 4)}`);
  }
  return lines.join("\r\n");
}

function csvEscape(s: string): string {
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildSpcStudyPdf(input: {
  header: SpcAuditHeader;
  numSubgroups: number;
  subgroupSize: number;
  cells: string[][];
  result: CapabilityResult | null;
  computeError: string | null;
}): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;
  let y = margin;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 22, "F");
  doc.setTextColor(248, 250, 252);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Process Capability Study", margin, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Statistical Process Control · Audit record", margin, 19);
  doc.setTextColor(15, 23, 42);
  y = 28;

  const infoRows: string[][] = [
    ["Part name", input.header.partName || "—"],
    ["Part no.", input.header.partNo || "—"],
    ["Operation", input.header.operation || "—"],
    ["Machine no.", input.header.machineNo || "—"],
    ["Date", input.header.date || "—"],
    ["Instrument", input.header.instrumentName || "—"],
    ["Target", input.header.target || "—"],
    ["USL", input.header.upperTolerance || "—"],
    ["LSL", input.header.lowerTolerance || "—"],
    ["Subgroups × size", `${input.numSubgroups} × ${input.subgroupSize}`],
  ];
  autoTable(doc, {
    startY: y,
    head: [["Field", "Value"]],
    body: infoRows,
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    margin: { left: margin, right: margin },
  });
  y = ((doc as JsPdfWithTable).lastAutoTable?.finalY ?? y) + 6;

  const measHead = Array.from({ length: input.subgroupSize }, (_, i) => `M${i + 1}`);
  const tableBody: (string | number)[][] = [];
  for (let r = 0; r < input.numSubgroups; r++) {
    const row = input.cells[r] ?? [];
    const cells = row.slice(0, input.subgroupSize).map((c) => (c.trim() === "" ? "—" : c.trim()));
    while (cells.length < input.subgroupSize) cells.push("—");
    const sg = input.result?.subgroups.find((s) => s.index === r + 1);
    tableBody.push([
      r + 1,
      ...cells,
      sg ? formatCapability(sg.mean, 4) : "—",
      sg ? formatCapability(sg.range, 4) : "—",
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: [["Sg", ...measHead, "X̄", "R"]],
    body: tableBody,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1 },
    headStyles: { fillColor: [51, 65, 85], textColor: 255 },
    margin: { left: margin, right: margin },
  });
  y = ((doc as JsPdfWithTable).lastAutoTable?.finalY ?? y) + 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Summary", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  if (input.computeError) {
    doc.setTextColor(185, 28, 28);
    doc.text(input.computeError, margin, y);
    doc.setTextColor(15, 23, 42);
  } else if (input.result) {
    const lines = [
      `Grand mean (X̄̄): ${formatCapability(input.result.grandMean, 6)}`,
      `Average range (R̄): ${formatCapability(input.result.averageRange, 6)}`,
      `d₂ (n=${input.subgroupSize}): ${formatCapability(input.result.d2, 4)}`,
      `Estimated σ (R̄/d₂): ${formatCapability(input.result.sigma, 6)}`,
      `Cp: ${formatCapability(input.result.cp, 4)}`,
      `Cpk: ${formatCapability(input.result.cpk, 4)}`,
    ];
    for (const line of lines) {
      doc.text(line, margin, y);
      y += 4.5;
    }
  }

  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
}
