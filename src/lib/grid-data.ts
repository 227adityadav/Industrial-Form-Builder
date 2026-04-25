import type {
  GridCellRangeBoundsEntry,
  GridColumnNode,
  GridData,
  GridDataRow,
  Id,
  InputType,
} from "@/types/form-schema";

function isLeaf(col: GridColumnNode): boolean {
  return !col.children || col.children.length === 0;
}

function collectLeafIds(cols: GridColumnNode[], out: Id[] = []): Id[] {
  for (const c of cols) {
    if (isLeaf(c)) out.push(c.id);
    else collectLeafIds(c.children ?? [], out);
  }
  return out;
}

function collectLeafInputsWalk(
  cols: GridColumnNode[],
  out: { id: Id; inputType: InputType }[] = []
): { id: Id; inputType: InputType }[] {
  for (const c of cols) {
    if (isLeaf(c)) out.push({ id: c.id, inputType: c.leaf?.inputType ?? "text" });
    else collectLeafInputsWalk(c.children ?? [], out);
  }
  return out;
}

/** Leaf column ids in visual order with their configured input type. */
export function collectLeafInputs(columns: GridColumnNode[]): { id: Id; inputType: InputType }[] {
  return collectLeafInputsWalk(columns, []);
}

/**
 * Resize grid data to match row count and keep only values for current leaf column ids.
 */
export function alignGridData(columns: GridColumnNode[], rowCount: number, prior: GridData | undefined): GridData {
  const leafIds = collectLeafIds(columns);
  const source = prior ?? [];
  const rows: GridData = [];
  for (let r = 0; r < rowCount; r++) {
    const row = source[r] ?? {};
    const next: GridDataRow = {};
    for (const id of leafIds) {
      if (id in row) next[id] = row[id]!;
    }
    rows.push(next);
  }
  return rows;
}

/** Drop per-cell range entries whose row or leaf column no longer exists. */
export function pruneCellRangeBounds(
  bounds: Record<string, GridCellRangeBoundsEntry> | undefined,
  columns: GridColumnNode[],
  rowCount: number
): Record<string, GridCellRangeBoundsEntry> | undefined {
  if (!bounds) return undefined;
  const leafIds = new Set(collectLeafIds(columns));
  const out: Record<string, GridCellRangeBoundsEntry> = {};
  for (const [k, v] of Object.entries(bounds)) {
    const idx = k.indexOf(":");
    if (idx < 0) continue;
    const row = Number(k.slice(0, idx));
    const leafId = k.slice(idx + 1);
    if (!Number.isFinite(row) || row < 0 || row >= rowCount) continue;
    if (!leafIds.has(leafId)) continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}
