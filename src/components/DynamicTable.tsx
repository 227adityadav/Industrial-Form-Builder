import * as React from "react";
import { gridCellValueIsPresent } from "@/lib/grid-cell-present";
import {
  gridCellRangeKey,
  type GridCellRangeBoundsEntry,
  type GridCellValue,
  type GridColumnNode,
  type GridData,
  type Id,
  type InputType,
} from "@/types/form-schema";

type CellValue = GridCellValue;
export type { GridData };

type LeafColumn = GridColumnNode & { children?: undefined; leaf?: { inputType: InputType } };

function isLeaf(col: GridColumnNode): col is LeafColumn {
  return !col.children || col.children.length === 0;
}

function maxDepth(cols: GridColumnNode[]): number {
  let depth = 0;
  for (const c of cols) {
    depth = Math.max(depth, 1 + (c.children?.length ? maxDepth(c.children) : 0));
  }
  return depth;
}

function leafCount(col: GridColumnNode): number {
  if (isLeaf(col)) return 1;
  return (col.children ?? []).reduce((sum, child) => sum + leafCount(child), 0);
}

function collectLeaves(cols: GridColumnNode[], out: GridColumnNode[] = []): GridColumnNode[] {
  for (const c of cols) {
    if (isLeaf(c)) out.push(c);
    else collectLeaves(c.children ?? [], out);
  }
  return out;
}

type HeaderCell = {
  id: Id;
  label: string;
  colSpan: number;
  rowSpan: number;
  width?: number;
  isLeaf: boolean;
};

function buildHeaderRows(cols: GridColumnNode[]): HeaderCell[][] {
  const depth = maxDepth(cols);
  const rows: HeaderCell[][] = Array.from({ length: depth }, () => []);

  const walk = (nodes: GridColumnNode[], level: number) => {
    for (const node of nodes) {
      const hasChildren = !!node.children?.length;
      const colSpan = hasChildren ? leafCount(node) : 1;
      const rowSpan = hasChildren ? 1 : depth - level;
      rows[level].push({
        id: node.id,
        label: node.label,
        colSpan,
        rowSpan,
        width: node.width,
        isLeaf: !hasChildren,
      });
      if (hasChildren) walk(node.children ?? [], level + 1);
    }
  };

  walk(cols, 0);
  return rows;
}

function coerceInput(value: string, inputType: InputType): string | number | boolean | null {
  if (value === "") return null;
  if (inputType === "number") return Number(value);
  if (inputType === "toggle") return value === "true";
  return value;
}

function effectiveBoundsForCell(
  leaf: GridColumnNode["leaf"],
  row: number,
  leafId: Id,
  cellRangeBounds?: Record<string, GridCellRangeBoundsEntry>
): { min?: number; max?: number } | null {
  const o = cellRangeBounds?.[gridCellRangeKey(row, leafId)];
  if (o?.skipHighlight) return null;
  const min =
    typeof o?.min === "number" && Number.isFinite(o.min) ? o.min : leaf?.min;
  const max =
    typeof o?.max === "number" && Number.isFinite(o.max) ? o.max : leaf?.max;
  const minOk = typeof min === "number" && Number.isFinite(min);
  const maxOk = typeof max === "number" && Number.isFinite(max);
  if (!minOk && !maxOk) return null;
  return {
    ...(minOk ? { min } : {}),
    ...(maxOk ? { max } : {}),
  };
}

/** `null` = empty / not applicable; `false` = non-numeric when a value is present */
function parseNumericForRange(value: CellValue): number | null | false {
  if (value == null) return null;
  if (typeof value === "boolean") return false;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : false;
  }
  const s = String(value).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : false;
}

type RangeOutline = "none" | "in" | "out";

function numericRangeOutline(
  bounds: { min?: number; max?: number } | null,
  value: CellValue
): RangeOutline {
  if (!bounds) return "none";
  const parsed = parseNumericForRange(value);
  if (parsed === null) return "none";
  if (parsed === false) return "out";
  const n = parsed;
  const min = typeof bounds.min === "number" && Number.isFinite(bounds.min) ? bounds.min : undefined;
  const max = typeof bounds.max === "number" && Number.isFinite(bounds.max) ? bounds.max : undefined;
  if (min != null && n < min) return "out";
  if (max != null && n > max) return "out";
  if (min == null && max == null) return "none";
  return "in";
}

function rangeOutlineClass(outline: RangeOutline): string {
  if (outline === "in") return "rounded-md ring-2 ring-inset ring-green-600/55";
  if (outline === "out") return "rounded-md ring-2 ring-inset ring-red-600/60";
  return "";
}

function priorValueIsPresent(prior: CellValue | undefined, inputType: InputType): prior is CellValue {
  return gridCellValueIsPresent(prior, inputType);
}

function cellValuesMatch(a: CellValue, b: CellValue, inputType: InputType): boolean {
  if (inputType === "toggle") return Boolean(a) === Boolean(b);
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a === "number" || typeof b === "number") {
    const na = Number(a);
    const nb = Number(b);
    return !Number.isNaN(na) && !Number.isNaN(nb) && na === nb;
  }
  return String(a) === String(b);
}

/** Short label shown on the prior-value chip (the actual stored value). */
function formatPriorChipFace(prior: CellValue, inputType: InputType): string {
  if (inputType === "toggle") return prior ? "Yes" : "No";
  if (prior == null) return "";
  if (inputType === "date" && typeof prior === "string") {
    try {
      const d = new Date(prior);
      if (!Number.isNaN(d.getTime())) return d.toLocaleDateString();
    } catch {
      /* fall through */
    }
  }
  const s = String(prior);
  return s.length > 22 ? `${s.slice(0, 20)}…` : s;
}

function GridCellPriorPopup({
  htmlId,
  inputType,
  prior,
  onUse,
}: {
  htmlId: string;
  inputType: InputType;
  prior: CellValue;
  onUse: () => void;
}) {
  const full =
    inputType === "toggle"
      ? prior
        ? "Previously: checked"
        : "Previously: unchecked"
      : `Previous: ${prior == null ? "" : String(prior)}`;

  return (
    <button
      id={htmlId}
      type="button"
      title={full}
      aria-label={`Use previous value: ${full}`}
      className="pointer-events-auto absolute -top-0.5 right-0 z-20 hidden max-w-[min(11rem,calc(100%-0.25rem))] truncate rounded-md border border-emerald-600/35 bg-white px-1.5 py-0.5 text-left text-[11px] font-semibold leading-tight text-emerald-900 shadow-md ring-1 ring-emerald-600/15 transition hover:bg-emerald-50 group-focus-within/cell:block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-600/50"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onUse();
      }}
    >
      {formatPriorChipFace(prior, inputType)}
    </button>
  );
}

function renderInput(
  inputType: InputType,
  value: CellValue,
  onChange: (next: CellValue) => void
) {
  if (inputType === "toggle") {
    const checked = Boolean(value);
    return (
      <input
        type="checkbox"
        className="h-4 w-4"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    );
  }

  const type = inputType === "date" ? "date" : inputType === "number" ? "number" : "text";
  return (
    <input
      type={type}
      className="w-full bg-transparent outline-none"
      value={value == null ? "" : String(value)}
      onChange={(e) => onChange(coerceInput(e.target.value, inputType))}
    />
  );
}

function renderReadonlyCell(inputType: InputType, value: CellValue) {
  if (inputType === "toggle") {
    const checked = Boolean(value);
    return (
      <input
        type="checkbox"
        className="h-4 w-4"
        checked={checked}
        readOnly
        tabIndex={-1}
      />
    );
  }

  const type = inputType === "date" ? "date" : inputType === "number" ? "number" : "text";
  return (
    <input
      type={type}
      className="w-full cursor-default bg-transparent outline-none"
      value={value == null ? "" : String(value)}
      readOnly
      tabIndex={-1}
    />
  );
}

export function DynamicTable({
  columns,
  data,
  onChange,
  readOnly = false,
  cellRangeBounds,
  rangePickMode = false,
  onPickCellForRange,
  rangeEditSelection,
  suggestionGrid,
  /** Aligned template default grid (admin live preview); used with {@link lockPrefilledFromTemplate}. */
  templateDefaultsGrid,
  /** When true, cells that have a non-empty template default are read-only (operator mode). */
  lockPrefilledFromTemplate = false,
}: {
  columns: GridColumnNode[];
  data: GridData;
  onChange?: (next: GridData) => void;
  readOnly?: boolean;
  cellRangeBounds?: Record<string, GridCellRangeBoundsEntry>;
  /** When true, clicking a body cell notifies {@link onPickCellForRange} (admin per-cell range UI). */
  rangePickMode?: boolean;
  onPickCellForRange?: (pick: { row: number; leafId: Id }) => void;
  /** Highlights the selected cell while in range pick mode. */
  rangeEditSelection?: { row: number; leafId: Id } | null;
  /** Prior submission grid for this block (same shape as {@link data}) — used for per-cell suggestions. */
  suggestionGrid?: GridData | null;
  templateDefaultsGrid?: GridData;
  lockPrefilledFromTemplate?: boolean;
}) {
  const headerRows = React.useMemo(() => buildHeaderRows(columns), [columns]);
  const leaves = React.useMemo(() => collectLeaves(columns), [columns]);

  const refs = React.useRef<Map<string, HTMLInputElement | null>>(new Map());
  const keyFor = (r: number, leafId: Id) => `${r}:${leafId}`;

  const isTemplateLockedCell = React.useCallback(
    (r: number, leafIdx: number) => {
      if (!lockPrefilledFromTemplate || !templateDefaultsGrid) return false;
      const leaf = leaves[leafIdx];
      if (!leaf) return false;
      const inputType = leaf.leaf?.inputType ?? "text";
      const def = templateDefaultsGrid[r]?.[leaf.id];
      return gridCellValueIsPresent(def, inputType);
    },
    [lockPrefilledFromTemplate, templateDefaultsGrid, leaves]
  );

  const focusCell = (r: number, c: number) => {
    if (readOnly) return;
    const leaf = leaves[c];
    if (!leaf || isTemplateLockedCell(r, c)) return;
    const key = keyFor(r, leaf.id);
    const el = refs.current.get(key);
    el?.focus();
    el?.select?.();
  };

  return (
    <div className="ui-table-shell w-full overflow-auto">
      <table className="min-w-full border-separate border-spacing-0">
        <thead className="bg-gradient-to-b from-zinc-100 to-zinc-50/90">
          {headerRows.map((row, rIdx) => (
            <tr key={rIdx}>
              {row.map((cell) => (
                <th
                  key={cell.id}
                  colSpan={cell.colSpan}
                  rowSpan={cell.rowSpan}
                  className="sticky top-0 z-10 border-b border-zinc-200/90 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600"
                  style={cell.isLeaf && cell.width ? { minWidth: cell.width } : undefined}
                >
                  {cell.label}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {data.map((row, rIdx) => (
            <tr key={rIdx} className="odd:bg-white even:bg-zinc-50/50">
              {leaves.map((leaf, cIdx) => {
                const inputType = leaf.leaf?.inputType ?? "text";
                const value = row[leaf.id] ?? null;
                const key = keyFor(rIdx, leaf.id);
                const bounds =
                  inputType === "toggle"
                    ? null
                    : effectiveBoundsForCell(leaf.leaf, rIdx, leaf.id, cellRangeBounds);
                const rangeOutline = numericRangeOutline(bounds, value);
                const rangeClass = rangeOutlineClass(rangeOutline);
                const picked =
                  rangePickMode &&
                  rangeEditSelection?.row === rIdx &&
                  rangeEditSelection.leafId === leaf.id;
                const pickClass = picked ? "rounded-md p-0.5 ring-2 ring-inset ring-violet-500/65" : "";

                const priorRaw = suggestionGrid?.[rIdx]?.[leaf.id];
                const templateLocked = isTemplateLockedCell(rIdx, cIdx);
                const showCellSuggestion =
                  !readOnly &&
                  !templateLocked &&
                  !rangePickMode &&
                  onChange &&
                  suggestionGrid &&
                  priorValueIsPresent(priorRaw, inputType) &&
                  !cellValuesMatch(value, priorRaw as CellValue, inputType);

                const applyPriorToCell = (prior: CellValue) => {
                  if (!onChange) return;
                  const nextData = [...data];
                  nextData[rIdx] = { ...nextData[rIdx], [leaf.id]: prior };
                  onChange(nextData);
                };

                const hasPriorChip = showCellSuggestion && priorRaw !== undefined;

                return (
                  <td
                    key={leaf.id}
                    className="overflow-visible border-b border-zinc-100 px-3 py-2 align-top"
                    style={leaf.width ? { minWidth: leaf.width } : undefined}
                    onClick={() => {
                      if (rangePickMode && onPickCellForRange) {
                        onPickCellForRange({ row: rIdx, leafId: leaf.id });
                      }
                      if (!templateLocked) focusCell(rIdx, cIdx);
                    }}
                  >
                    <div className={`${pickClass}`.trim()}>
                      <div className={`min-h-6 ${rangeClass}`.trim()}>
                      {readOnly || templateLocked ? (
                        renderReadonlyCell(inputType, value)
                      ) : inputType === "toggle" ? (
                        <div className="group/cell relative min-h-7 overflow-visible pt-0.5">
                          <input
                            ref={(el) => {
                              refs.current.set(key, el);
                            }}
                            type="checkbox"
                            className="relative z-0 h-4 w-4"
                            checked={Boolean(value)}
                            onChange={(e) => {
                              if (!onChange) return;
                              const nextData = [...data];
                              nextData[rIdx] = { ...nextData[rIdx], [leaf.id]: e.target.checked };
                              onChange(nextData);
                            }}
                          />
                          {hasPriorChip ? (
                            <GridCellPriorPopup
                              htmlId={`sug-${key}`}
                              inputType={inputType}
                              prior={priorRaw as CellValue}
                              onUse={() => applyPriorToCell(priorRaw as CellValue)}
                            />
                          ) : null}
                        </div>
                      ) : (
                        <div className="group/cell relative min-h-8 overflow-visible pt-1">
                          <input
                            ref={(el) => {
                              refs.current.set(key, el);
                            }}
                            autoComplete="off"
                            className={
                              `relative z-0 w-full rounded-md border border-transparent bg-transparent px-1.5 py-0.5 outline-none transition-colors hover:border-zinc-200/80 focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/30 ${hasPriorChip ? "pr-7" : ""}`.trim()
                            }
                            type={
                              inputType === "date"
                                ? "date"
                                : inputType === "number"
                                  ? "number"
                                  : "text"
                            }
                            value={value == null ? "" : String(value)}
                            onChange={(e) => {
                              if (!onChange) return;
                              const next = coerceInput(e.target.value, inputType);
                              const nextData = [...data];
                              nextData[rIdx] = { ...nextData[rIdx], [leaf.id]: next };
                              onChange(nextData);
                            }}
                            onKeyDown={(e) => {
                              if (e.key !== "Tab") return;
                              e.preventDefault();
                              const dir = e.shiftKey ? -1 : 1;
                              let nextR = rIdx;
                              let nextC = cIdx;
                              const maxSteps = leaves.length * data.length + 2;
                              for (let step = 0; step < maxSteps; step++) {
                                nextC += dir;
                                while (true) {
                                  if (nextC < 0) {
                                    nextR -= 1;
                                    if (nextR < 0) return;
                                    nextC = leaves.length - 1;
                                    continue;
                                  }
                                  if (nextC >= leaves.length) {
                                    nextR += 1;
                                    if (nextR >= data.length) return;
                                    nextC = 0;
                                    continue;
                                  }
                                  break;
                                }
                                if (!isTemplateLockedCell(nextR, nextC)) {
                                  focusCell(nextR, nextC);
                                  return;
                                }
                              }
                            }}
                          />
                          {hasPriorChip ? (
                            <GridCellPriorPopup
                              htmlId={`sug-${key}`}
                              inputType={inputType}
                              prior={priorRaw as CellValue}
                              onUse={() => applyPriorToCell(priorRaw as CellValue)}
                            />
                          ) : null}
                        </div>
                      )}
                      </div>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

