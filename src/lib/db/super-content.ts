import { connectToDatabase } from "@/lib/db/connection";
import { SuperFormTemplateModel } from "@/lib/db/models";
import { normalizeFormSchema } from "@/lib/form-schema-normalize";
import type { FormSchema, Id } from "@/types/form-schema";

type SuperTemplateRow = FormSchema & { createdAt: string; updatedAt: string };

export class DuplicateSuperTemplateNameError extends Error {
  constructor(name: string) {
    super(`Super template name "${name}" already exists`);
    this.name = "DuplicateSuperTemplateNameError";
  }
}

function normalizeTemplateName(name: string): string {
  return name.trim().toLowerCase();
}

export async function listSuperTemplatesNormalized(): Promise<FormSchema[]> {
  await connectToDatabase();
  const raw = (await SuperFormTemplateModel.find().lean().exec()) as SuperTemplateRow[];
  return raw.map((t) => normalizeFormSchema(t));
}

export async function getSuperTemplateById(id: string): Promise<FormSchema | null> {
  await connectToDatabase();
  const t = (await SuperFormTemplateModel.collection.findOne({ id })) as SuperTemplateRow | null;
  return t ? normalizeFormSchema(t) : null;
}

export async function upsertSuperTemplate(
  body: Partial<FormSchema> & { id: string; name: string }
): Promise<SuperTemplateRow> {
  await connectToDatabase();
  const now = new Date().toISOString();
  const normalized = normalizeFormSchema(body);
  const normalizedName = normalizeTemplateName(normalized.name);
  if (!normalizedName) {
    throw new Error("Super template name is required");
  }
  const templates = await listSuperTemplatesNormalized();
  const duplicateByNormalizedName = templates.find(
    (template) => template.id !== normalized.id && normalizeTemplateName(template.name) === normalizedName
  );
  if (duplicateByNormalizedName) {
    throw new DuplicateSuperTemplateNameError(normalized.name);
  }
  const existing = (await SuperFormTemplateModel.collection.findOne({ id: body.id })) as SuperTemplateRow | null;
  const record: SuperTemplateRow = {
    ...normalized,
    name: normalized.name.trim(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await SuperFormTemplateModel.collection.replaceOne({ id: body.id }, record as unknown as Record<string, unknown>, {
    upsert: true,
  });
  return record;
}

export async function deleteSuperTemplateById(id: Id) {
  await connectToDatabase();
  await SuperFormTemplateModel.collection.deleteOne({ id });
}
