import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connection";
import { deleteFolderById } from "@/lib/db/content";

export const dynamic = "force-dynamic";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase();
  const { id } = await params;
  await deleteFolderById(id);
  return NextResponse.json({ ok: true });
}
