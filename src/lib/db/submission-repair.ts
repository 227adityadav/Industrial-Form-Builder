import { normalizeFormSchema } from "@/lib/form-schema-normalize";
import type { FolderRecord } from "@/types/folder";
import type { FormSchema } from "@/types/form-schema";
import type { SubmissionRecord } from "@/types/submission";
import { normalizeSubmissionStatus } from "@/types/submission";
import { randomUuid } from "@/lib/random-uuid";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export type RepairSummary = {
  total: number;
  repaired: number;
  dropped: number;
};

export function repairSubmissionRecords(
  submissions: SubmissionRecord[],
  templates: FormSchema[],
  folders: FolderRecord[]
): { records: SubmissionRecord[]; summary: RepairSummary } {
  const templateById = new Map(templates.map((t) => [t.id, normalizeFormSchema(t)]));
  const folderById = new Map(folders.map((f) => [f.id, f]));

  const repaired: SubmissionRecord[] = [];
  let repairedCount = 0;
  let dropped = 0;

  for (const raw of submissions) {
    const templateId = typeof raw.templateId === "string" ? raw.templateId.trim() : "";
    const template = templateById.get(templateId);
    if (!templateId || !template) {
      dropped += 1;
      continue;
    }

    const id =
      typeof raw.id === "string" && raw.id.trim().length > 0 ? raw.id.trim() : randomUuid();
    const submittedAt =
      typeof raw.submittedAt === "string" && !Number.isNaN(Date.parse(raw.submittedAt))
        ? raw.submittedAt
        : new Date().toISOString();
    const updatedAt =
      typeof raw.updatedAt === "string" && !Number.isNaN(Date.parse(raw.updatedAt))
        ? raw.updatedAt
        : submittedAt;

    let folderId = typeof raw.folderId === "string" && raw.folderId.trim().length > 0 ? raw.folderId.trim() : undefined;
    if (folderId) {
      const folder = folderById.get(folderId);
      if (!folder || !folder.templateIds.includes(templateId)) {
        folderId = undefined;
      }
    }

    const next: SubmissionRecord = {
      id,
      templateId,
      templateSnapshot: normalizeFormSchema(
        raw.templateSnapshot?.id === templateId ? raw.templateSnapshot : template
      ),
      folderId,
      username: typeof raw.username === "string" ? raw.username : undefined,
      submittedAt,
      updatedAt,
      submissionStatus: normalizeSubmissionStatus(raw),
      top: isPlainRecord(raw.top) ? raw.top : {},
      grid: raw.grid ?? null,
      footer: isPlainRecord(raw.footer) ? raw.footer : {},
      revealFills: Array.isArray(raw.revealFills) ? raw.revealFills : undefined,
    };

    if (JSON.stringify(next) !== JSON.stringify(raw)) {
      repairedCount += 1;
    }
    repaired.push(next);
  }

  return {
    records: repaired,
    summary: {
      total: submissions.length,
      repaired: repairedCount,
      dropped,
    },
  };
}
