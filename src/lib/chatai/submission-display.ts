import type { FormSchema, FormSection, GridColumnNode, GridDataRow } from "@/types/form-schema";
import type { RevealFillInstance, SubmissionRecord } from "@/types/submission";

export type FilledFieldRow = {
  section: string;
  label: string;
  value: string;
};

function walkGridColumns(nodes: GridColumnNode[], path: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const n of nodes) {
    const next = [...path, n.label];
    if (n.children?.length) {
      walkGridColumns(n.children, next).forEach((v, k) => out.set(k, v));
    } else if (n.leaf) {
      out.set(n.id, next.join(" › "));
    }
  }
  return out;
}

function stringifyCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    if (v.startsWith("data:image")) return "[image]";
    if (v.startsWith("data:")) return "[file]";
    if (v.length > 120) return `${v.slice(0, 117)}…`;
    return v;
  }
  if (typeof v === "object") return "[object]";
  return String(v);
}

function isEmptyCell(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  if (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0) return true;
  return false;
}

function sectionById(schema: FormSchema, id: string): FormSection | undefined {
  return schema.sections.find((s) => s.id === id);
}

/** Flatten operator-entered values with template labels when schema is known. */
export function flattenFilledFields(
  submission: SubmissionRecord,
  schema: FormSchema | null,
  opts?: { maxRows?: number },
): FilledFieldRow[] {
  const maxRows = opts?.maxRows ?? 200;
  const rows: FilledFieldRow[] = [];

  const push = (section: string, label: string, value: unknown) => {
    if (rows.length >= maxRows) return;
    const s = stringifyCell(value);
    if (!s || isEmptyCell(value)) return;
    rows.push({ section, label, value: s });
  };

  if (schema) {
    for (const sec of schema.sections) {
      if (sec.kind === "fields") {
        const title = sec.title?.trim() || "Info fields";
        for (const f of sec.fields) {
          if (Object.prototype.hasOwnProperty.call(submission.top, f.id)) {
            push(title, f.label, submission.top[f.id]);
          }
        }
      }
    }
    for (const ff of schema.footer.fields) {
      if (Object.prototype.hasOwnProperty.call(submission.footer, ff.id)) {
        push("Footer", ff.label, (submission.footer as Record<string, unknown>)[ff.id]);
      }
    }

    const gridObj = submission.grid;
    if (gridObj && typeof gridObj === "object" && !Array.isArray(gridObj)) {
      for (const [sectionId, gridRows] of Object.entries(gridObj as Record<string, unknown>)) {
        if (!Array.isArray(gridRows)) continue;
        const sec = sectionById(schema, sectionId);
        const secTitle =
          sec?.kind === "grid" ? sec.title?.trim() || "Grid" : `Grid (${sectionId.slice(0, 8)})`;
        const colLabels =
          sec?.kind === "grid" ? walkGridColumns(sec.grid.columns, []) : new Map<string, string>();

        gridRows.forEach((rawRow, ri) => {
          if (!rawRow || typeof rawRow !== "object" || Array.isArray(rawRow)) return;
          const row = rawRow as GridDataRow;
          for (const [colId, cell] of Object.entries(row)) {
            if (isEmptyCell(cell)) continue;
            const label = colLabels.get(colId) ?? colId.slice(0, 8);
            push(`${secTitle} · row ${ri + 1}`, label, cell);
          }
        });
      }
    }
  } else {
    for (const [k, v] of Object.entries(submission.top)) {
      push("Top fields", k.slice(0, 8), v);
    }
    for (const [k, v] of Object.entries(submission.footer)) {
      push("Footer", k.slice(0, 8), v);
    }
    const g = submission.grid;
    if (g && typeof g === "object" && !Array.isArray(g)) {
      for (const [sid, gridRows] of Object.entries(g as Record<string, unknown>)) {
        if (!Array.isArray(gridRows)) continue;
        gridRows.forEach((rawRow, ri) => {
          if (!rawRow || typeof rawRow !== "object") return;
          for (const [cid, cell] of Object.entries(rawRow as GridDataRow)) {
            if (isEmptyCell(cell)) continue;
            push(`Grid ${sid.slice(0, 6)} · row ${ri + 1}`, cid.slice(0, 8), cell);
          }
        });
      }
    }
  }

  if (Array.isArray(submission.revealFills)) {
    submission.revealFills.forEach((fill: RevealFillInstance, idx: number) => {
      const tag = `Reveal ${idx + 1}`;
      if (schema) {
        for (const sec of schema.sections) {
          if (sec.kind === "fields" && sec.revealButtonId === fill.revealButtonId) {
            const title = sec.title?.trim() || "Reveal fields";
            for (const f of sec.fields) {
              if (Object.prototype.hasOwnProperty.call(fill.top, f.id)) {
                push(`${tag} · ${title}`, f.label, fill.top[f.id]);
              }
            }
          }
        }
      } else {
        for (const [k, v] of Object.entries(fill.top)) {
          push(tag, k.slice(0, 8), v);
        }
      }
      const fg = fill.grid;
      if (fg && typeof fg === "object" && !Array.isArray(fg) && schema) {
        for (const [sectionId, gridRows] of Object.entries(fg as Record<string, unknown>)) {
          if (!Array.isArray(gridRows)) continue;
          const sec = sectionById(schema, sectionId);
          const secTitle =
            sec?.kind === "grid" ? sec.title?.trim() || "Grid" : `Grid (${sectionId.slice(0, 8)})`;
          const colLabels =
            sec?.kind === "grid" ? walkGridColumns(sec.grid.columns, []) : new Map<string, string>();
          gridRows.forEach((rawRow, ri) => {
            if (!rawRow || typeof rawRow !== "object") return;
            for (const [colId, cell] of Object.entries(rawRow as GridDataRow)) {
              if (isEmptyCell(cell)) continue;
              const label = colLabels.get(colId) ?? colId.slice(0, 8);
              push(`${tag} · ${secTitle} · row ${ri + 1}`, label, cell);
            }
          });
        }
      } else if (fg && typeof fg === "object" && !Array.isArray(fg)) {
        for (const [sid, gridRows] of Object.entries(fg as Record<string, unknown>)) {
          if (!Array.isArray(gridRows)) continue;
          gridRows.forEach((rawRow, ri) => {
            if (!rawRow || typeof rawRow !== "object") return;
            for (const [cid, cell] of Object.entries(rawRow as GridDataRow)) {
              if (isEmptyCell(cell)) continue;
              push(`${tag} · grid ${sid.slice(0, 6)} · row ${ri + 1}`, cid.slice(0, 8), cell);
            }
          });
        }
      }
    });
  }

  return rows;
}

export function summarizeFilledInline(
  submission: SubmissionRecord,
  schema: FormSchema | null,
  maxPairs: number,
): string {
  const scanCap = Math.min(600, Math.max(maxPairs * 18, maxPairs + 40));
  const rows = flattenFilledFields(submission, schema, { maxRows: scanCap });
  const pairs = rows.slice(0, maxPairs).map((r) => `${r.label}: ${r.value}`);
  const more = rows.length > maxPairs ? " …" : "";
  return pairs.length ? pairs.join(" · ") + more : "—";
}
