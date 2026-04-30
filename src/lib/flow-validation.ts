import type { FolderRecord } from "@/types/folder";
import type { FormSchema } from "@/types/form-schema";

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function normalizeIdList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  return out;
}

export function validateFolderSchedule(input: {
  nextFillDueHours?: number | null;
  nextFillDueDays?: number | null;
  nextFillDueTime?: string | null;
}): string | null {
  const hasHours = typeof input.nextFillDueHours === "number" && Number.isFinite(input.nextFillDueHours);
  const hasDays = typeof input.nextFillDueDays === "number" && Number.isFinite(input.nextFillDueDays);
  const hasTime = typeof input.nextFillDueTime === "string" && input.nextFillDueTime.trim().length > 0;

  if (hasHours && input.nextFillDueHours! <= 0) return "nextFillDueHours must be > 0";
  if (hasDays && input.nextFillDueDays! <= 0) return "nextFillDueDays must be > 0";

  if (hasHours && (hasDays || hasTime)) {
    return "nextFillDueHours cannot be combined with nextFillDueDays/nextFillDueTime";
  }
  if (hasDays !== hasTime) {
    return "nextFillDueDays and nextFillDueTime must be set together";
  }
  if (hasTime && !/^\d{2}:\d{2}$/.test(input.nextFillDueTime!.trim())) {
    return "nextFillDueTime must be in HH:mm format";
  }
  return null;
}

export function ensureTemplateAllowedInFolder(
  folder: FolderRecord | null,
  templateId: string
): string | null {
  if (!folder) return null;
  if (!folder.templateIds.includes(templateId)) {
    return "Template is not assigned to the selected folder";
  }
  return null;
}

export function validateFormSchemaIntegrity(schema: FormSchema): string | null {
  const sectionIds = new Set<string>();
  for (const section of schema.sections) {
    if (!section.id?.trim()) return "Section id is required";
    if (sectionIds.has(section.id)) return "Duplicate section id found";
    sectionIds.add(section.id);
  }

  const buttonIds = new Set<string>();
  for (const btn of schema.revealButtons ?? []) {
    if (!btn.id?.trim()) return "Reveal button id is required";
    if (buttonIds.has(btn.id)) return "Duplicate reveal button id found";
    buttonIds.add(btn.id);
  }

  for (const section of schema.sections) {
    if ((section.kind === "fields" || section.kind === "grid") && section.revealButtonId) {
      if (!buttonIds.has(section.revealButtonId)) {
        return "Section references an unknown reveal button";
      }
    }
  }
  return null;
}
