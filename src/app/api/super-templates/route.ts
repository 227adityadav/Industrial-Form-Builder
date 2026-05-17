import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connection";
import {
  DuplicateSuperTemplateNameError,
  listSuperTemplatesNormalized,
  upsertSuperTemplate,
} from "@/lib/db/super-content";
import { dbErrorMessage } from "@/lib/db/error-message";
import { normalizeFormSchema } from "@/lib/form-schema-normalize";
import { validateFormSchemaIntegrity } from "@/lib/flow-validation";
import { requireAnyRole, requireRole } from "@/lib/require-role";
import type { FormSchema } from "@/types/form-schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAnyRole("superadmin", "superoperator");
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  }
  try {
    await connectToDatabase();
    const templates = await listSuperTemplatesNormalized();
    return NextResponse.json({ templates: templates.map((t) => normalizeFormSchema(t)) });
  } catch (error) {
    return NextResponse.json({ error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const auth = await requireRole("superadmin");
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  }
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
    const record = await upsertSuperTemplate(normalized);
    return NextResponse.json({ ok: true, template: record });
  } catch (error) {
    if (error instanceof DuplicateSuperTemplateNameError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Error && error.message === "Super template name is required") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: dbErrorMessage(error) }, { status: 500 });
  }
}
