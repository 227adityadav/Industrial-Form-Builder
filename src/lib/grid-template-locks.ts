import { alignGridData, collectLeafInputs } from "@/lib/grid-data";
import { gridCellValueIsPresent } from "@/lib/grid-cell-present";
import { gridSectionsOf, parseSubmissionGrids } from "@/lib/submission-grids";
import type { FormSchema, GridBlockSection, GridData, GridDataRow } from "@/types/form-schema";

/**
 * For operators, force locked cells in one grid block back to template defaults.
 */
export function mergeUserGridOneSectionWithLocks(section: GridBlockSection, cur: GridData): GridData {
  const cols = section.grid.columns;
  const rowCount = section.grid.rowCount;
  const defaults = alignGridData(cols, rowCount, section.grid.defaults ?? []);
  const leaves = collectLeafInputs(cols);
  const next: GridData = [];

  for (let r = 0; r < rowCount; r++) {
    const row: GridDataRow = { ...(cur[r] ?? {}) };
    for (const { id: leafId, inputType } of leaves) {
      const def = defaults[r]?.[leafId];
      if (gridCellValueIsPresent(def, inputType)) {
        row[leafId] = def!;
      }
    }
    next.push(row);
  }
  return next;
}

/**
 * For operators, force grid cells that have a non-empty template default (admin live preview)
 * back to that default so tampered requests cannot change locked cells.
 */
export function mergeUserGridWithTemplateLocks(incomingGrid: unknown, template: FormSchema): Record<string, GridData> {
  const parsed = parseSubmissionGrids(incomingGrid, template);

  for (const s of gridSectionsOf(template)) {
    const cur = parsed[s.id] ?? alignGridData(s.grid.columns, s.grid.rowCount, []);
    parsed[s.id] = mergeUserGridOneSectionWithLocks(s, cur);
  }

  return parsed;
}
