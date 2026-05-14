import type { FormSchema } from "@/types/form-schema";
import type { SubmissionRecord } from "@/types/submission";
import { gridSectionsOf } from "@/lib/submission-grids";

function submissionGridSectionKeys(grid: unknown): Set<string> {
  if (grid && typeof grid === "object" && !Array.isArray(grid)) {
    return new Set(Object.keys(grid as Record<string, unknown>));
  }
  return new Set<string>();
}

function templateCoversSubmissionGridSectionKeys(template: FormSchema, keys: Set<string>): boolean {
  if (keys.size === 0) return true;
  const ids = new Set(gridSectionsOf(template).map((s) => s.id));
  for (const k of keys) {
    if (!ids.has(k)) return false;
  }
  return true;
}

/**
 * Schema used to hydrate grids/top/reveal rounds from persisted submission payloads.
 *
 * Prefer the submission's embedded snapshot whenever it matches stored section ids —
 * otherwise a live template that was edited in admin can redefine grid/block UUIDs so
 * `submission.grid` no longer aligns and renders as empty/template defaults (“dummy”).
 */
export function hydrationTemplateForSubmission(sub: SubmissionRecord, liveTemplate: FormSchema): FormSchema {
  const snap = sub.templateSnapshot;
  const keys = submissionGridSectionKeys(sub.grid);

  if (snap && snap.id === sub.templateId && templateCoversSubmissionGridSectionKeys(snap, keys)) {
    return snap;
  }

  if (
    snap &&
    templateCoversSubmissionGridSectionKeys(snap, keys) &&
    !templateCoversSubmissionGridSectionKeys(liveTemplate, keys)
  ) {
    return snap;
  }

  return liveTemplate;
}
