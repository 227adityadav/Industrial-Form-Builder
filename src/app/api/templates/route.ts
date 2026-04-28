import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connection";
import { DuplicateTemplateNameError, listTemplatesNormalized, upsertTemplate } from "@/lib/db/content";
import { normalizeFormSchema } from "@/lib/form-schema-normalize";
import type { FormSchema } from "@/types/form-schema";

export const dynamic = "force-dynamic";

export async function GET() {
  await connectToDatabase();
  const templates = await listTemplatesNormalized();
  return NextResponse.json({ templates: templates.map((t) => normalizeFormSchema(t)) });
}

export async function POST(req: Request) {
  await connectToDatabase();
  const body = (await req.json().catch(() => null)) as Partial<FormSchema> | null;
  const name = body?.name?.trim();
  if (!body?.id || !name) {
    return NextResponse.json({ error: "Missing id/name" }, { status: 400 });
  }
  try {
    const record = await upsertTemplate({ ...body, id: body.id, name });
    return NextResponse.json({ ok: true, template: record });
  } catch (error) {
    if (error instanceof DuplicateTemplateNameError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Error && error.message === "Template name is required") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to save template" }, { status: 500 });
  }
}
