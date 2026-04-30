import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connection";
import { getTemplateById, deleteTemplateById } from "@/lib/db/content";
import { normalizeFormSchema } from "@/lib/form-schema-normalize";
import type { Id } from "@/types/form-schema";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: Id }> }) {
  await connectToDatabase();
  const { id } = await params;
  const found = await getTemplateById(id);
  if (!found) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ template: normalizeFormSchema(found) });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: Id }> }) {
  await connectToDatabase();
  const { id } = await params;
  await deleteTemplateById(id);
  return NextResponse.json({ ok: true });
}
