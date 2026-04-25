import { readJsonFile } from "@/lib/storage";
import type { FormSchema } from "@/types/form-schema";
import type { FolderRecord, MasterFolderRecord } from "@/types/folder";
import type { RefillNotificationRecord } from "@/types/refill-notification";
import type { SubmissionRecord } from "@/types/submission";
import { FormTemplateModel, FolderModel, MasterFolderModel, RefillNotificationModel, SubmissionModel } from "@/lib/db/models";

type TemplateRow = FormSchema & { createdAt: string; updatedAt: string };

/**
 * On first run with an empty database, copy existing `form_*.json` from the project root into MongoDB
 * so local data is preserved when switching from file storage.
 */
export async function importFromProjectJsonIfEmpty(): Promise<void> {
  const [tN, fN, mN, sN, rN] = await Promise.all([
    FormTemplateModel.countDocuments(),
    FolderModel.countDocuments(),
    MasterFolderModel.countDocuments(),
    SubmissionModel.countDocuments(),
    RefillNotificationModel.countDocuments(),
  ]);
  if (tN > 0 && fN > 0 && mN > 0 && sN > 0 && rN > 0) {
    return;
  }

  const [templates, folders, masters, submissions, refills] = await Promise.all([
    tN > 0 ? [] : readJsonFile<TemplateRow[]>("form_templates.json", []),
    fN > 0 ? [] : readJsonFile<FolderRecord[]>("form_folders.json", []),
    mN > 0 ? [] : readJsonFile<MasterFolderRecord[]>("form_master_folders.json", []),
    sN > 0 ? [] : readJsonFile<SubmissionRecord[]>("form_submissions.json", []),
    rN > 0 ? [] : readJsonFile<RefillNotificationRecord[]>("form_refill_notifications.json", []),
  ]);

  if (templates.length) {
    // Use native collection so string `id` is stored (Mongoose may otherwise map `id` and break unique index).
    await FormTemplateModel.collection.insertMany(templates as unknown as Record<string, unknown>[], {
      ordered: false,
    });
  }
  if (folders.length) {
    await FolderModel.insertMany(
      folders.map((f) => ({
        _id: f.id,
        name: f.name,
        templateIds: f.templateIds,
        allowedUsernames: f.allowedUsernames,
        masterFolderIds: f.masterFolderIds,
        nextFillDueHours: f.nextFillDueHours ?? null,
        nextFillDueDays: f.nextFillDueDays ?? null,
        nextFillDueTime: f.nextFillDueTime ?? null,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      })),
      { ordered: false }
    );
  }
  if (masters.length) {
    await MasterFolderModel.insertMany(
      masters.map((m) => ({
        _id: m.id,
        name: m.name,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
      { ordered: false }
    );
  }
  if (submissions.length) {
    await SubmissionModel.collection.insertMany(
      submissions.map((s) => {
        const { id, ...rest } = s;
        return { _id: id, id, ...rest } as unknown as Record<string, unknown>;
      }),
      { ordered: false }
    );
  }
  if (refills.length) {
    const safe = refills.filter((r) => typeof r.id === "string" && r.id.length > 0);
    if (safe.length) {
      await RefillNotificationModel.collection.insertMany(
        safe as unknown as Record<string, unknown>[],
        { ordered: false }
      );
    }
  }
}
