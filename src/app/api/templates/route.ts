import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connection";
import { listTemplatesNormalized, upsertTemplate } from "@/lib/db/content";
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
  if (!body?.id || !body?.name) {
    return NextResponse.json({ error: "Missing id/name" }, { status: 400 });
  }
  const record = await upsertTemplate({ ...body, id: body.id, name: body.name });
  return NextResponse.json({ ok: true, template: record });
}
