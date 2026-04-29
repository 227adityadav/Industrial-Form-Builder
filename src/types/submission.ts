import type { FormSchema, GridData } from "./form-schema";

export type SubmissionStatus = "ongoing" | "final";

/**
 * One filled “round” for template sections tied to a {@link FormSchema.revealButtons} entry.
 * Operators may create many per button; each completed round sets `filledAt`.
 */
export type RevealFillInstance = {
  id: string;
  revealButtonId: string;
  openedAt: string;
  /** When the operator marked this round complete (shown in the filled list with timestamp). */
  filledAt?: string;
  top: Record<string, unknown>;
  /** Grid data keyed by grid block section id (only reveal-linked grids for this button). */
  grid: Record<string, GridData>;
};

export type SubmissionRecord = {
  id: string;
  templateId: string;
  /** Snapshot of template at save time to keep old submissions readable after template edits. */
  templateSnapshot?: FormSchema;
  folderId?: string;
  username?: string;
  submittedAt: string;
  updatedAt: string;
  /** Missing in legacy data — treated as `"final"`. */
  submissionStatus?: SubmissionStatus;
  top: Record<string, unknown>;
  grid: unknown;
  footer: Record<string, unknown>;
  /** Repeatable rounds for reveal-button sections (optional; legacy submissions omit this). */
  revealFills?: RevealFillInstance[];
};

export function normalizeSubmissionStatus(s: SubmissionRecord | { submissionStatus?: SubmissionStatus }): SubmissionStatus {
  return s.submissionStatus === "ongoing" ? "ongoing" : "final";
}
