import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connection";
import { deleteSuperTemplateById, getSuperTemplateById } from "@/lib/db/super-content";
import { normalizeFormSchema } from "@/lib/form-schema-normalize";
import { requireRole } from "@/lib/require-role";
import type { Id } from "@/types/form-schema";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: Id }> }) {
  const auth = await requireRole("superadmin");
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  }
  await connectToDatabase();
  const { id } = await params;
  const found = await getSuperTemplateById(id);
  if (!found) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ template: normalizeFormSchema(found) });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: Id }> }) {
  const auth = await requireRole("superadmin");
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  }
  await connectToDatabase();
  const { id } = await params;
  await deleteSuperTemplateById(id);
  return NextResponse.json({ ok: true });
}
