import type { FormSchema, GridBlockSection, GridData } from "@/types/form-schema";
import { alignGridData } from "@/lib/grid-data";

export function gridSectionsOf(template: FormSchema): GridBlockSection[] {
  return template.sections.filter((s): s is GridBlockSection => s.kind === "grid");
}

function asGridData(value: unknown): GridData {
  if (!Array.isArray(value)) return [];
  return value.filter((r) => r && typeof r === "object") as GridData;
}

/**
 * Legacy submissions store `grid` as a single `GridData` array. New submissions use
 * `Record<sectionId, GridData>` when the template has one or more grid blocks.
 */
export function parseSubmissionGrids(raw: unknown, template: FormSchema): Record<string, GridData> {
  const grids = gridSectionsOf(template);
  const out: Record<string, GridData> = {};

  if (grids.length === 0) return out;

  const rowCountFor = (g: GridBlockSection, prior: GridData) =>
    Math.max(g.grid.rowCount, prior.length);

  if (Array.isArray(raw)) {
    const g0 = grids[0]!;
    const prior0 = asGridData(raw);
    out[g0.id] = alignGridData(g0.grid.columns, rowCountFor(g0, prior0), prior0);
    for (let i = 1; i < grids.length; i++) {
      const g = grids[i]!;
      out[g.id] = alignGridData(g.grid.columns, g.grid.rowCount, []);
    }
    return out;
  }

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    for (const g of grids) {
      const prior = asGridData(obj[g.id]);
      out[g.id] = alignGridData(g.grid.columns, rowCountFor(g, prior), prior);
    }
    return out;
  }

  for (const g of grids) {
    out[g.id] = alignGridData(g.grid.columns, g.grid.rowCount, []);
  }
  return out;
}

export function defaultGridsFromTemplate(template: FormSchema): Record<string, GridData> {
  const out: Record<string, GridData> = {};
  for (const s of gridSectionsOf(template)) {
    out[s.id] = alignGridData(s.grid.columns, s.grid.rowCount, s.grid.defaults ?? []);
  }
  return out;
}
