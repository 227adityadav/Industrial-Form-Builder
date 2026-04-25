import type { FolderRecord } from "@/types/folder";

/** Raw JSON may omit `masterFolderIds` or use legacy single `masterFolderId`. */
export type StoredFolder = Omit<FolderRecord, "masterFolderIds"> & {
  masterFolderIds?: string[];
  masterFolderId?: string | null;
};

export function normalizeFolderRecord(raw: StoredFolder): FolderRecord {
  const ids = new Set<string>(raw.masterFolderIds ?? []);
  if (raw.masterFolderId) ids.add(raw.masterFolderId);
  return {
    id: raw.id,
    name: raw.name,
    templateIds: raw.templateIds ?? [],
    allowedUsernames: raw.allowedUsernames ?? [],
    masterFolderIds: [...ids],
    nextFillDueHours: raw.nextFillDueHours ?? null,
    nextFillDueDays: raw.nextFillDueDays ?? null,
    nextFillDueTime: raw.nextFillDueTime ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}
