export type Id = string;

export type InputType = "text" | "number" | "select" | "date" | "toggle";

/** Info-field input kinds (includes digital signature and file upload; grid cells use {@link InputType} only). */
export type TopFieldInputType = InputType | "signature" | "file";

export interface SelectOption {
  id: Id;
  label: string;
  value: string;
}

export interface BaseField {
  id: Id;
  label: string;
  inputType: TopFieldInputType;
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  options?: SelectOption[]; // for select
}

export type TopField = BaseField;

export type FooterFieldKind = "signature" | "timestamp" | "verification";

export interface FooterFieldBase {
  id: Id;
  label: string;
  required?: boolean;
}

export interface SignatureField extends FooterFieldBase {
  kind: "signature";
  signerRole?: string;
}

export interface TimestampField extends FooterFieldBase {
  kind: "timestamp";
  mode?: "auto_now" | "user_entry";
}

export interface VerificationField extends FooterFieldBase {
  kind: "verification";
  inputType: "toggle" | "select" | "text";
  options?: SelectOption[];
}

export type FooterField = SignatureField | TimestampField | VerificationField;

export type CalcOperator =
  | "between_inclusive"
  | "between_exclusive"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "eq"
  | "neq";

export interface PassFailRule {
  operator: CalcOperator;
  value?: number | string | boolean;
  min?: number;
  max?: number;
  passLabel?: string; // default: Pass
  failLabel?: string; // default: Fail
}

export interface LeafConfig {
  inputType: InputType;
  /** Inclusive lower bound for numeric cell validation (operator grid outline). */
  min?: number;
  /** Inclusive upper bound for numeric cell validation (operator grid outline). */
  max?: number;
  required?: boolean;
  options?: SelectOption[];
  calcMode?: {
    enabled: boolean;
    rule?: PassFailRule;
  };
}

/**
 * Recursive header engine node.
 * - Parent header: has children[] (renders with colspan)
 * - Leaf column: no children (renders as an input cell)
 */
export interface GridColumnNode {
  id: Id;
  label: string;
  width?: number; // px
  children?: GridColumnNode[];
  leaf?: LeafConfig; // only meaningful when children is empty/undefined
}

/** Values keyed by leaf column id (one object per grid row). */
export type GridCellValue = string | number | boolean | null;
export type GridDataRow = Record<Id, GridCellValue>;
export type GridData = GridDataRow[];

/** Optional bounds or “no highlight” for one grid cell (keyed by {@link gridCellRangeKey}). */
export interface GridCellRangeBoundsEntry {
  min?: number;
  max?: number;
  /** When true, green/red outline is off for this cell (column min/max are ignored here). */
  skipHighlight?: boolean;
}

export interface GridSection {
  columns: GridColumnNode[];
  rowCount: number;
  /** Cell values from the admin live preview; used to pre-fill user forms for blank cells/rows. */
  defaults?: GridData;
  /**
   * Per-cell min/max for range outline (merged with each leaf’s `min`/`max`).
   * Use {@link gridCellRangeKey} for keys.
   */
  cellRangeBounds?: Record<string, GridCellRangeBoundsEntry>;
}

/** Stable key for `GridSection.cellRangeBounds`: zero-based row index and leaf column id. */
export function gridCellRangeKey(rowIndex: number, leafColumnId: Id): string {
  return `${rowIndex}:${leafColumnId}`;
}

/** Named control shown on the operator form; blocks can be hidden until one of these is used. */
export interface FormRevealButton {
  id: Id;
  label: string;
}

/** A group of label + input fields (same controls as the former single “top info” block). */
export interface FieldsSection {
  id: Id;
  kind: "fields";
  /** Optional heading shown on the form and in the builder. */
  title?: string;
  /**
   * When set, this block stays hidden until the operator activates the matching
   * {@link FormSchema.revealButtons} control. Omit for always-visible blocks.
   */
  revealButtonId?: Id;
  fields: TopField[];
}

/** Nested column headers + row grid. Templates may include several grids in any order. */
export interface GridBlockSection {
  id: Id;
  kind: "grid";
  title?: string;
  /**
   * When set, this block stays hidden until the operator activates the matching
   * {@link FormSchema.revealButtons} control. Omit for always-visible blocks.
   */
  revealButtonId?: Id;
  grid: GridSection;
}

export type FormSection = FieldsSection | GridBlockSection;

export interface FormSchema {
  id: Id;
  name: string;
  version: number;
  /** Ordered body: mix info-field blocks and grids as needed. */
  sections: FormSection[];
  /**
   * Optional opener buttons for progressive disclosure. Assign a button id per section
   * via {@link FieldsSection.revealButtonId} / {@link GridBlockSection.revealButtonId}.
   */
  revealButtons?: FormRevealButton[];
  footer: {
    fields: FooterField[];
  };
}

