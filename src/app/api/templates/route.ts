import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connection";
import { DuplicateTemplateNameError, listTemplatesNormalized, upsertTemplate } from "@/lib/db/content";
import { dbErrorMessage } from "@/lib/db/error-message";
import { normalizeFormSchema } from "@/lib/form-schema-normalize";
import { validateFormSchemaIntegrity } from "@/lib/flow-validation";
import type { FormSchema } from "@/types/form-schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();
    const templates = await listTemplatesNormalized();
    return NextResponse.json({ templates: templates.map((t) => normalizeFormSchema(t)) });
  } catch (error) {
    return NextResponse.json({ error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const body = (await req.json().catch(() => null)) as Partial<FormSchema> | null;
    const name = body?.name?.trim();
    if (!body?.id || !name) {
      return NextResponse.json({ error: "Missing id/name" }, { status: 400 });
    }
    const normalized = normalizeFormSchema({ ...body, id: body.id, name });
    const integrityError = validateFormSchemaIntegrity(normalized);
    if (integrityError) {
      return NextResponse.json({ error: integrityError }, { status: 400 });
    }
    const record = await upsertTemplate(normalized);
    return NextResponse.json({ ok: true, template: record });
  } catch (error) {
    if (error instanceof DuplicateTemplateNameError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Error && error.message === "Template name is required") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: dbErrorMessage(error) }, { status: 500 });
  }
}
