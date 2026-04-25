/** Manager-defined container; regular folders can belong to zero or more masters. */
export type MasterFolderRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type FolderRecord = {
  id: string;
  name: string;
  templateIds: string[];
  allowedUsernames: string[];
  /** Manager UI: this folder may appear under several master groups at once. */
  masterFolderIds: string[];
  /**
   * After each final submission, the next fill is due this many hours later.
   * Mutually exclusive with `nextFillDueDays` / `nextFillDueTime`.
   */
  nextFillDueHours?: number | null;
  /**
   * Days after finalization; combined with `nextFillDueTime` (local server time).
   * Used when `nextFillDueHours` is not set.
   */
  nextFillDueDays?: number | null;
  /** `"HH:mm"` — used with `nextFillDueDays`. */
  nextFillDueTime?: string | null;
  createdAt: string;
  updatedAt: string;
};

