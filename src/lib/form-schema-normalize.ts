import { newLeaf } from "@/lib/grid-ops";
import { randomUuid } from "@/lib/random-uuid";
import type {
  FieldsSection,
  FooterField,
  FormRevealButton,
  FormSchema,
  FormSection,
  GridBlockSection,
  GridSection,
  TopField,
} from "@/types/form-schema";

/** Stable ids when migrating old `top` + `grid` templates without `sections`. */
export const LEGACY_FIELDS_SECTION_ID = "__legacy_fields";
export const LEGACY_GRID_SECTION_ID = "__legacy_grid";

function isTopField(x: unknown): x is TopField {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.label === "string" && typeof o.inputType === "string";
}

function isGridSection(x: unknown): x is GridSection {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return Array.isArray(o.columns) && typeof o.rowCount === "number" && o.rowCount >= 1;
}

function isFieldsSection(x: unknown): x is FieldsSection {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (o.kind !== "fields" || typeof o.id !== "string") return false;
  return Array.isArray(o.fields) && o.fields.every(isTopField);
}

function isGridBlockSection(x: unknown): x is GridBlockSection {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (o.kind !== "grid" || typeof o.id !== "string") return false;
  return isGridSection(o.grid);
}

function isFormSection(x: unknown): x is FormSection {
  return isFieldsSection(x) || isGridBlockSection(x);
}

/** Legacy persisted templates may include removed `upload` blocks — drop them. */
function stripUploadSections(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => {
    if (!x || typeof x !== "object") return false;
    return (x as { kind?: string }).kind !== "upload";
  });
}

function defaultFooter(raw: unknown): { fields: FooterField[] } {
  if (!raw || typeof raw !== "object") return { fields: [] };
  const o = raw as { fields?: unknown };
  if (!Array.isArray(o.fields)) return { fields: [] };
  return { fields: o.fields as FooterField[] };
}

function parseRevealButtons(raw: unknown): FormRevealButton[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  const out: FormRevealButton[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : null;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const labelRaw = typeof o.label === "string" ? o.label.trim() : "";
    out.push({ id, label: labelRaw || "Open section" });
  }
  return out.length ? out : undefined;
}

/** Keep only section `revealButtonId` values that match a defined opener button. */
function mergeRevealFromRaw(schema: FormSchema, raw: Record<string, unknown>): FormSchema {
  const revealButtons = parseRevealButtons(raw.revealButtons);
  const idSet = new Set((revealButtons ?? []).map((b) => b.id));
  const sections = schema.sections.map((sec) => {
    if (sec.kind === "fields") {
      const bid = sec.revealButtonId;
      if (typeof bid === "string" && idSet.has(bid)) return sec;
      const { revealButtonId: _drop, ...rest } = sec;
      return rest as FieldsSection;
    }
    if (sec.kind === "grid") {
      const bid = sec.revealButtonId;
      if (typeof bid === "string" && idSet.has(bid)) return sec;
      const { revealButtonId: _drop, ...rest } = sec;
      return rest as GridBlockSection;
    }
    return sec;
  });
  return {
    ...schema,
    sections,
    revealButtons: revealButtons?.length ? revealButtons : undefined,
  };
}

/**
 * Accepts persisted template JSON (including legacy `top` + `grid` only) and returns a `FormSchema` with `sections`.
 */
export function normalizeFormSchema(raw: unknown): FormSchema {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid template");
  }
  const r = raw as Record<string, unknown>;
  // Prefer persisting `id` on the document; if it is missing, _id (Mongo) is stable across reads
  // so we do not assign a new random id on every listTemplates call (which would break folder templateIds).
  const idFromDoc =
    typeof r.id === "string" && r.id
      ? r.id
      : r._id != null
        ? String((r as { _id: unknown })._id)
        : null;
  const id = idFromDoc ?? randomUuid();
  const name = typeof r.name === "string" ? r.name : "Untitled";
  const version = typeof r.version === "number" ? r.version : 1;
  const footer = defaultFooter(r.footer);

  const sectionsRaw = stripUploadSections(r.sections);
  if (sectionsRaw.length > 0 && sectionsRaw.every(isFormSection)) {
    const schema: FormSchema = {
      id,
      name,
      version,
      sections: sectionsRaw as FormSection[],
      footer,
    };
    return mergeRevealFromRaw(schema, r);
  }

  const top = r.top as { fields?: unknown[] } | undefined;
  const fields: TopField[] = Array.isArray(top?.fields) ? (top!.fields.filter(isTopField) as TopField[]) : [];

  let grid: GridSection;
  if (isGridSection(r.grid)) {
    grid = r.grid;
  } else {
    grid = { columns: [newLeaf("Specifications")], rowCount: 6 };
  }

  const schema: FormSchema = {
    id,
    name,
    version,
    sections: [
      { id: LEGACY_FIELDS_SECTION_ID, kind: "fields", title: "Info fields", fields },
      { id: LEGACY_GRID_SECTION_ID, kind: "grid", title: "Measurement grid", grid },
    ],
    footer,
  };
  return mergeRevealFromRaw(schema, r);
}
