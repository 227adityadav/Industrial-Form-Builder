import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connection";
import { submissionDocToRecord } from "@/lib/db/content";
import { SuperSubmissionModel } from "@/lib/db/models";
import { randomUuid } from "@/lib/random-uuid";
import type { SubmissionRecord } from "@/types/submission";

type SubmissionDoc = SubmissionRecord & { id: string };

function normalizeSubmissionId(input: SubmissionRecord): SubmissionDoc {
  const id = typeof input.id === "string" && input.id.trim().length > 0 ? input.id : randomUuid();
  return { ...input, id };
}

export async function listSuperSubmissionsAll(): Promise<SubmissionRecord[]> {
  await connectToDatabase();
  const raw = (await SuperSubmissionModel.find().lean().exec()) as Record<string, unknown>[];
  return raw.map(submissionDocToRecord).filter((s): s is SubmissionRecord => s !== null);
}

export async function getSuperSubmissionById(id: string): Promise<SubmissionRecord | null> {
  await connectToDatabase();
  const trimmed = id.trim();
  const oidHex = /^[a-fA-F0-9]{24}$/.test(trimmed);
  const d =
    (await SuperSubmissionModel.findOne({ id: trimmed }).lean().exec()) ??
    (await SuperSubmissionModel.findOne({ _id: trimmed }).lean().exec()) ??
    (oidHex ? await SuperSubmissionModel.findById(new mongoose.Types.ObjectId(trimmed)).lean().exec() : null);
  if (!d) return null;
  return submissionDocToRecord(d as Record<string, unknown>);
}

export async function insertSuperSubmission(record: SubmissionRecord) {
  await connectToDatabase();
  const normalized = normalizeSubmissionId(record);
  const { id, ...rest } = normalized;
  await SuperSubmissionModel.create({ _id: id, id, ...rest } as object);
}

export async function updateSuperSubmissionById(updated: SubmissionRecord) {
  await connectToDatabase();
  const normalized = normalizeSubmissionId(updated);
  const { id, ...rest } = normalized;
  const existing = (await SuperSubmissionModel.findOne({ id }, { _id: 1 }).lean().exec()) as
    | { _id?: unknown }
    | null;
  const stableObjectId =
    existing && typeof existing._id === "string" && existing._id.trim().length > 0
      ? existing._id
      : id;
  await SuperSubmissionModel.replaceOne(
    { _id: stableObjectId },
    { _id: stableObjectId, id, ...rest } as object,
    { upsert: true }
  );
}
