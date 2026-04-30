import { connectToDatabase } from "@/lib/db/connection";
import {
  FolderModel,
  FormTemplateModel,
  MasterFolderModel,
  RefillNotificationModel,
  SubmissionModel,
} from "@/lib/db/models";
import { normalizeFormSchema } from "@/lib/form-schema-normalize";
import { randomUuid } from "@/lib/random-uuid";
import { normalizeFolderRecord, type StoredFolder } from "@/lib/folder-record";
import type { FormSchema, Id } from "@/types/form-schema";
import type { FolderRecord, MasterFolderRecord } from "@/types/folder";
import type { RefillNotificationRecord } from "@/types/refill-notification";
import type { SubmissionRecord } from "@/types/submission";

type TemplateRow = FormSchema & { createdAt: string; updatedAt: string };
type SubmissionDoc = SubmissionRecord & { id: string };

export class DuplicateTemplateNameError extends Error {
  constructor(name: string) {
    super(`Template name "${name}" already exists`);
    this.name = "DuplicateTemplateNameError";
  }
}

function normalizeTemplateName(name: string): string {
  return name.trim().toLowerCase();
}

function folderDocToStored(d: { _id: string; [k: string]: unknown }): StoredFolder {
  const { _id, ...rest } = d;
  return { ...(rest as object), id: _id } as StoredFolder;
}

function masterDocToRecord(d: { _id: string; name: string; createdAt: string; updatedAt: string }): MasterFolderRecord {
  return { id: d._id, name: d.name, createdAt: d.createdAt, updatedAt: d.updatedAt };
}

// --- templates ---

export async function listTemplatesNormalized(): Promise<FormSchema[]> {
  await connectToDatabase();
  const raw = (await FormTemplateModel.find().lean().exec()) as TemplateRow[];
  return raw.map((t) => normalizeFormSchema(t));
}

export async function getTemplateById(id: string): Promise<FormSchema | null> {
  await connectToDatabase();
  const t = (await FormTemplateModel.findOne({ id }).lean()) as TemplateRow | null;
  return t ? normalizeFormSchema(t) : null;
}

export async function getTemplateByIdForPdf(id: string): Promise<TemplateRow | null> {
  await connectToDatabase();
  return (await FormTemplateModel.findOne({ id }).lean()) as TemplateRow | null;
}

export async function upsertTemplate(body: Partial<FormSchema> & { id: string; name: string }): Promise<TemplateRow> {
  await connectToDatabase();
  const now = new Date().toISOString();
  const normalized = normalizeFormSchema(body);
  const normalizedName = normalizeTemplateName(normalized.name);
  if (!normalizedName) {
    throw new Error("Template name is required");
  }
  const templates = await listTemplatesNormalized();
  const duplicateByNormalizedName = templates.find(
    (template) => template.id !== normalized.id && normalizeTemplateName(template.name) === normalizedName
  );
  if (duplicateByNormalizedName) {
    throw new DuplicateTemplateNameError(normalized.name);
  }
  const existing = (await FormTemplateModel.findOne({ id: body.id }).lean()) as TemplateRow | null;
  const record: TemplateRow = {
    ...normalized,
    name: normalized.name.trim(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await FormTemplateModel.replaceOne({ id: body.id }, record, { upsert: true });
  return record;
}

export async function deleteTemplateById(id: Id) {
  await connectToDatabase();
  await FormTemplateModel.deleteOne({ id });
}

export async function listTemplateRowsForImport(): Promise<FormSchema[]> {
  await connectToDatabase();
  return (await FormTemplateModel.find().lean().exec()) as FormSchema[];
}

// --- folders ---

export async function listFoldersNormalized(): Promise<ReturnType<typeof normalizeFolderRecord>[]> {
  await connectToDatabase();
  const raw = (await FolderModel.find().lean().exec()) as { _id: string; [k: string]: unknown }[];
  return raw.map((d) => normalizeFolderRecord(folderDocToStored(d)));
}

export async function upsertFolder(
  body: {
    id?: string;
    name: string;
    templateIds?: string[];
    allowedUsernames?: string[];
    masterFolderIds?: string[];
    nextFillDueHours?: number | null;
    nextFillDueDays?: number | null;
    nextFillDueTime?: string | null;
  }
): Promise<FolderRecord> {
  await connectToDatabase();
  const now = new Date().toISOString();
  const id = body.id ?? randomUuid();
  const existingDoc = (await FolderModel.findOne({ _id: id }).lean()) as { _id: string; [k: string]: unknown } | null;
  const prev = existingDoc ? normalizeFolderRecord(folderDocToStored(existingDoc)) : null;
  const masterFolderIds =
    body.masterFolderIds !== undefined
      ? [...new Set(body.masterFolderIds.filter(Boolean))]
      : (prev?.masterFolderIds ?? []);
  const record: FolderRecord = {
    id,
    name: body.name.trim(),
    templateIds: body.templateIds !== undefined ? body.templateIds : (prev?.templateIds ?? []),
    allowedUsernames:
      body.allowedUsernames !== undefined ? body.allowedUsernames : (prev?.allowedUsernames ?? []),
    masterFolderIds,
    nextFillDueHours:
      body.nextFillDueHours !== undefined ? body.nextFillDueHours : (prev?.nextFillDueHours ?? null),
    nextFillDueDays:
      body.nextFillDueDays !== undefined ? body.nextFillDueDays : (prev?.nextFillDueDays ?? null),
    nextFillDueTime:
      body.nextFillDueTime !== undefined ? body.nextFillDueTime : (prev?.nextFillDueTime ?? null),
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  };
  const doc = {
    _id: id,
    name: record.name,
    templateIds: record.templateIds,
    allowedUsernames: record.allowedUsernames,
    masterFolderIds: record.masterFolderIds,
    nextFillDueHours: record.nextFillDueHours,
    nextFillDueDays: record.nextFillDueDays,
    nextFillDueTime: record.nextFillDueTime,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  await FolderModel.replaceOne({ _id: id }, doc, { upsert: true });
  return record;
}

export async function deleteFolderById(id: string) {
  await connectToDatabase();
  await FolderModel.deleteOne({ _id: id });
}

export async function getFolderById(id: string): Promise<FolderRecord | null> {
  await connectToDatabase();
  const raw = (await FolderModel.findOne({ _id: id }).lean()) as { _id: string; [k: string]: unknown } | null;
  return raw ? normalizeFolderRecord(folderDocToStored(raw)) : null;
}

export async function listFolderRecordsRaw(): Promise<StoredFolder[]> {
  await connectToDatabase();
  const raw = (await FolderModel.find().lean().exec()) as { _id: string; [k: string]: unknown }[];
  return raw.map((d) => folderDocToStored(d));
}

export async function replaceAllFolders(folders: FolderRecord[]) {
  await connectToDatabase();
  const ts = new Date().toISOString();
  const nextFolders = folders.map((f) => {
    const doc = {
      _id: f.id,
      name: f.name,
      templateIds: f.templateIds,
      allowedUsernames: f.allowedUsernames,
      masterFolderIds: f.masterFolderIds,
      nextFillDueHours: f.nextFillDueHours ?? null,
      nextFillDueDays: f.nextFillDueDays ?? null,
      nextFillDueTime: f.nextFillDueTime ?? null,
      createdAt: f.createdAt,
      updatedAt: ts,
    };
    return doc;
  });
  for (const doc of nextFolders) {
    await FolderModel.replaceOne({ _id: doc._id }, doc, { upsert: true });
  }
}

// --- master folders ---

export async function listMasterFolders(): Promise<MasterFolderRecord[]> {
  await connectToDatabase();
  const raw = (await MasterFolderModel.find()
    .lean()
    .sort({ createdAt: -1 })
    .exec()) as { _id: string; name: string; createdAt: string; updatedAt: string }[];
  return raw.map(masterDocToRecord);
}

export async function createMasterFolder(name: string): Promise<MasterFolderRecord> {
  await connectToDatabase();
  const now = new Date().toISOString();
  const id = randomUuid();
  const record: MasterFolderRecord = { id, name, createdAt: now, updatedAt: now };
  await MasterFolderModel.create({ _id: id, name, createdAt: now, updatedAt: now });
  return record;
}

export async function updateMasterFolderName(id: string, name: string): Promise<MasterFolderRecord | null> {
  await connectToDatabase();
  const now = new Date().toISOString();
  const m = await MasterFolderModel.findByIdAndUpdate(
    id,
    { $set: { name, updatedAt: now } },
    { new: true }
  ).lean() as { _id: string; name: string; createdAt: string; updatedAt: string } | null;
  return m ? masterDocToRecord(m) : null;
}

export async function deleteMasterFolderAndDetach(id: string): Promise<{ ok: boolean }> {
  await connectToDatabase();
  const res = await MasterFolderModel.deleteOne({ _id: id });
  if (res.deletedCount === 0) return { ok: false };
  const folders = await listFolderRecordsRaw();
  const next: FolderRecord[] = folders.map((raw) => {
    const f = normalizeFolderRecord(raw);
    if (!f.masterFolderIds.includes(id)) return f;
    return { ...f, masterFolderIds: f.masterFolderIds.filter((x) => x !== id), updatedAt: new Date().toISOString() };
  });
  await replaceAllFolders(next);
  return { ok: true };
}

// --- submissions ---

export function submissionDocToRecord(d: Record<string, unknown>): SubmissionRecord {
  const s = d as unknown as SubmissionRecord;
  return { ...s, id: (d.id as string) ?? (d._id as string) };
}

function normalizeSubmissionId(input: SubmissionRecord): SubmissionDoc {
  const id = typeof input.id === "string" && input.id.trim().length > 0 ? input.id : randomUuid();
  return { ...input, id };
}

export async function listSubmissionsAll(): Promise<SubmissionRecord[]> {
  await connectToDatabase();
  const raw = (await SubmissionModel.find().lean().exec()) as Record<string, unknown>[];
  return raw.map(submissionDocToRecord);
}

export async function getSubmissionById(id: string): Promise<SubmissionRecord | null> {
  await connectToDatabase();
  const d =
    (await SubmissionModel.findOne({ id }).lean().exec()) ??
    (await SubmissionModel.findById(id).lean().exec());
  if (!d) return null;
  return submissionDocToRecord(d as Record<string, unknown>);
}

export async function insertSubmission(record: SubmissionRecord) {
  await connectToDatabase();
  const normalized = normalizeSubmissionId(record);
  const { id, ...rest } = normalized;
  await SubmissionModel.create({ _id: id, id, ...rest } as object);
}

export async function saveSubmissionsInOrder(list: SubmissionRecord[]) {
  await connectToDatabase();
  await SubmissionModel.deleteMany({});
  if (list.length === 0) return;
  await SubmissionModel.insertMany(
    list.map((s) => {
      const normalized = normalizeSubmissionId(s);
      const { id, ...rest } = normalized;
      return { _id: id, id, ...rest };
    }),
    { ordered: true }
  );
}

export async function updateSubmissionById(updated: SubmissionRecord) {
  await connectToDatabase();
  const normalized = normalizeSubmissionId(updated);
  const { id, ...rest } = normalized;
  const existing = (await SubmissionModel.findOne({ id }, { _id: 1 }).lean().exec()) as
    | { _id?: unknown }
    | null;
  const stableObjectId =
    existing && typeof existing._id === "string" && existing._id.trim().length > 0
      ? existing._id
      : id;
  await SubmissionModel.replaceOne({ _id: stableObjectId }, { _id: stableObjectId, id, ...rest } as object, {
    upsert: true,
  });
}

// --- refill ---

export async function listRefillNotifications(): Promise<RefillNotificationRecord[]> {
  await connectToDatabase();
  return (await RefillNotificationModel.find().lean().sort({ createdAt: -1 }).exec()) as RefillNotificationRecord[];
}

export async function replaceAllRefillNotifications(list: RefillNotificationRecord[]) {
  await connectToDatabase();
  await RefillNotificationModel.deleteMany({});
  if (list.length) await RefillNotificationModel.insertMany(list);
}

