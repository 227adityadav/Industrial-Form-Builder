import { listRefillNotifications, replaceAllRefillNotifications } from "@/lib/db/content";
import { listFolderRecordsRaw } from "@/lib/db/content";
import { getTemplateById } from "@/lib/db/content";
import { normalizeFolderRecord, type StoredFolder } from "@/lib/folder-record";
import { computeNextFillDueAt } from "@/lib/refill-due";
import type { RefillNotificationRecord } from "@/types/refill-notification";
import type { SubmissionRecord } from "@/types/submission";
import { normalizeSubmissionStatus } from "@/types/submission";
/**
 * After a final submission, schedule or replace the refill reminder for this folder + template.
 */
export async function upsertRefillNotificationForSubmission(submission: SubmissionRecord): Promise<void> {
  if (normalizeSubmissionStatus(submission) !== "final") return;
  if (!submission.folderId) return;

  const folders = await listFolderRecordsRaw();
  const rawFolder = folders.find((f) => f.id === submission.folderId);
  if (!rawFolder) return;
  const folder = normalizeFolderRecord(rawFolder as StoredFolder);

  const anchor = submission.updatedAt ?? submission.submittedAt;
  const dueAt = computeNextFillDueAt(anchor, folder);
  if (!dueAt) return;

  const t = await getTemplateById(submission.templateId);
  const names = t ? { [t.id]: t.name } as Record<string, string> : ({} as Record<string, string>);

  const list = await listRefillNotifications();
  const fid = submission.folderId;
  const tid = submission.templateId;
  const next = list.filter((n) => !(n.folderId === fid && n.templateId === tid));

  const now = new Date().toISOString();
  const record: RefillNotificationRecord = {
    id: crypto.randomUUID(),
    folderId: fid,
    folderName: folder.name,
    templateId: tid,
    templateName: names[tid] ?? tid,
    submissionId: submission.id,
    username: submission.username,
    finalizedAt: anchor,
    dueAt,
    createdAt: now,
    readAt: null,
  };
  next.unshift(record);
  await replaceAllRefillNotifications(next);
}
