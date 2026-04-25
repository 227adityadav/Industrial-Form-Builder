import { alignGridData, collectLeafInputs } from "@/lib/grid-data";
import { randomUuid } from "@/lib/random-uuid";
import { gridCellValueIsPresent } from "@/lib/grid-cell-present";
import { mergeUserGridOneSectionWithLocks } from "@/lib/grid-template-locks";
import type { FormSchema, FormSection, GridBlockSection, GridData } from "@/types/form-schema";
import type { RevealFillInstance, SubmissionRecord } from "@/types/submission";
import { parseSubmissionGrids } from "@/lib/submission-grids";

export function sectionsForRevealButton(template: FormSchema, revealButtonId: string): FormSection[] {
  const defs = template.revealButtons ?? [];
  if (!defs.some((b) => b.id === revealButtonId)) return [];
  return template.sections.filter(
    (s) =>
      (s.kind === "fields" || s.kind === "grid") && s.revealButtonId === revealButtonId
  );
}

export function emptyRevealFillInstance(template: FormSchema, revealButtonId: string): RevealFillInstance {
  const grid: Record<string, GridData> = {};
  for (const sec of sectionsForRevealButton(template, revealButtonId)) {
    if (sec.kind === "grid") {
      grid[sec.id] = alignGridData(sec.grid.columns, sec.grid.rowCount, sec.grid.defaults ?? []);
    }
  }
  return {
    id: randomUuid(),
    revealButtonId,
    openedAt: new Date().toISOString(),
    top: {},
    grid,
  };
}

export function baseFieldIds(template: FormSchema): Set<string> {
  const set = new Set<string>();
  for (const s of template.sections) {
    if (s.kind === "fields" && !s.revealButtonId) for (const f of s.fields) set.add(f.id);
  }
  return set;
}

export function baseGridSectionIds(template: FormSchema): Set<string> {
  return new Set(
    template.sections
      .filter((s): s is GridBlockSection => s.kind === "grid" && !s.revealButtonId)
      .map((s) => s.id)
  );
}

export function revealFieldIds(template: FormSchema, revealButtonId: string): Set<string> {
  const set = new Set<string>();
  for (const s of template.sections) {
    if (s.kind === "fields" && s.revealButtonId === revealButtonId) for (const f of s.fields) set.add(f.id);
  }
  return set;
}

export function pruneTopToBase(top: Record<string, unknown>, template: FormSchema): Record<string, unknown> {
  const allow = baseFieldIds(template);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(top)) {
    if (allow.has(k)) out[k] = v;
  }
  return out;
}

function gridDataHasUserInput(data: GridData, section: GridBlockSection): boolean {
  const leaves = collectLeafInputs(section.grid.columns);
  for (const row of data) {
    if (!row) continue;
    for (const { id: leafId, inputType } of leaves) {
      const v = row[leafId];
      if (gridCellValueIsPresent(v, inputType)) return true;
    }
  }
  return false;
}

function isRevealFillRow(x: unknown): x is RevealFillInstance {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.revealButtonId === "string" &&
    typeof o.openedAt === "string" &&
    typeof o.top === "object" &&
    o.top !== null &&
    !Array.isArray(o.top) &&
    typeof o.grid === "object" &&
    o.grid !== null &&
    !Array.isArray(o.grid)
  );
}

/** Align grid slices and drop entries tied to unknown buttons. */
export function sanitizeRevealFills(
  raw: unknown,
  template: FormSchema
): RevealFillInstance[] {
  if (!Array.isArray(raw)) return [];
  const btnIds = new Set((template.revealButtons ?? []).map((b) => b.id));
  const out: RevealFillInstance[] = [];
  for (const x of raw) {
    if (!isRevealFillRow(x)) continue;
    if (!btnIds.has(x.revealButtonId)) continue;
    const grid: Record<string, GridData> = {};
    for (const sec of sectionsForRevealButton(template, x.revealButtonId)) {
      if (sec.kind !== "grid") continue;
      const prior = (x.grid as Record<string, unknown>)[sec.id];
      const rows = Array.isArray(prior) ? (prior as GridData) : [];
      grid[sec.id] = alignGridData(sec.grid.columns, sec.grid.rowCount, rows);
    }
    out.push({
      id: x.id,
      revealButtonId: x.revealButtonId,
      openedAt: x.openedAt,
      filledAt: typeof x.filledAt === "string" ? x.filledAt : undefined,
      top: { ...(x.top as Record<string, unknown>) },
      grid,
    });
  }
  return out;
}

export function defaultBaseGridsFromTemplate(template: FormSchema): Record<string, GridData> {
  const out: Record<string, GridData> = {};
  for (const id of baseGridSectionIds(template)) {
    const sec = template.sections.find((s) => s.id === id && s.kind === "grid") as GridBlockSection | undefined;
    if (!sec) continue;
    out[id] = alignGridData(sec.grid.columns, sec.grid.rowCount, sec.grid.defaults ?? []);
  }
  return out;
}

export function buildBaseGridFromRaw(gridRaw: unknown, template: FormSchema): Record<string, GridData> {
  const parsed = parseSubmissionGrids(gridRaw, template);
  const out: Record<string, GridData> = {};
  for (const id of baseGridSectionIds(template)) {
    const sec = template.sections.find((s) => s.id === id && s.kind === "grid") as GridBlockSection | undefined;
    if (!sec) continue;
    out[id] = parsed[id] ?? alignGridData(sec.grid.columns, sec.grid.rowCount, sec.grid.defaults ?? []);
  }
  return out;
}

/**
 * For editing: base top/grid (always-visible blocks) + reveal rounds.
 * Migrates legacy flat `top`/`grid` into `revealFills` when the array is missing but template uses reveal buttons.
 */
export function splitSubmissionForEdit(
  submission: SubmissionRecord,
  template: FormSchema
): {
  baseTop: Record<string, unknown>;
  baseGrid: Record<string, GridData>;
  revealFills: RevealFillInstance[];
} {
  const rb = template.revealButtons ?? [];
  if (rb.length === 0) {
    return {
      baseTop: { ...(submission.top ?? {}) },
      baseGrid: buildBaseGridFromRaw(submission.grid, template),
      revealFills: [],
    };
  }

  if (Array.isArray(submission.revealFills) && submission.revealFills.length > 0) {
    return {
      baseTop: pruneTopToBase(submission.top ?? {}, template),
      baseGrid: buildBaseGridFromRaw(submission.grid, template),
      revealFills: sanitizeRevealFills(submission.revealFills, template),
    };
  }

  const top = { ...(submission.top ?? {}) };
  const fullGrid = parseSubmissionGrids(submission.grid, template);
  const migrated: RevealFillInstance[] = [];

  for (const btn of rb) {
    const fieldIds = revealFieldIds(template, btn.id);
    const gridSecs = template.sections.filter(
      (s): s is GridBlockSection => s.kind === "grid" && s.revealButtonId === btn.id
    );
    const instTop: Record<string, unknown> = {};
    let any = false;
    for (const fid of fieldIds) {
      if (fid in top && top[fid] !== undefined && top[fid] !== "" && top[fid] !== null) {
        instTop[fid] = top[fid];
        any = true;
      }
    }
    const instGrid: Record<string, GridData> = {};
    for (const g of gridSecs) {
      const d = fullGrid[g.id];
      if (d && gridDataHasUserInput(d, g)) {
        instGrid[g.id] = d;
        any = true;
      }
    }
    if (any) {
      migrated.push({
        id: randomUuid(),
        revealButtonId: btn.id,
        openedAt: submission.submittedAt,
        filledAt: submission.updatedAt ?? submission.submittedAt,
        top: instTop,
        grid: instGrid,
      });
      for (const fid of fieldIds) delete top[fid];
    }
  }

  const baseGridParsed = parseSubmissionGrids(submission.grid, template);
  const baseGrid: Record<string, GridData> = {};
  for (const id of baseGridSectionIds(template)) {
    const sec = template.sections.find((s) => s.id === id && s.kind === "grid") as GridBlockSection | undefined;
    if (!sec) continue;
    baseGrid[id] = baseGridParsed[id] ?? alignGridData(sec.grid.columns, sec.grid.rowCount, []);
  }

  return {
    baseTop: pruneTopToBase(top, template),
    baseGrid,
    revealFills: sanitizeRevealFills(migrated, template),
  };
}

export function mergeRevealFillGridsForOperator(
  fills: RevealFillInstance[] | undefined,
  template: FormSchema
): RevealFillInstance[] {
  if (!fills?.length) return [];
  return fills.map((f) => {
    const grid: Record<string, GridData> = { ...f.grid };
    for (const sec of sectionsForRevealButton(template, f.revealButtonId)) {
      if (sec.kind !== "grid") continue;
      const cur = grid[sec.id] ?? alignGridData(sec.grid.columns, sec.grid.rowCount, []);
      grid[sec.id] = mergeUserGridOneSectionWithLocks(sec, cur);
    }
    return { ...f, grid };
  });
}
