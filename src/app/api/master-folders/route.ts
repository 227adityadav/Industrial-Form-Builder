import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connection";
import { listMasterFolders, createMasterFolder } from "@/lib/db/content";

export const dynamic = "force-dynamic";

export async function GET() {
  await connectToDatabase();
  const masters = await listMasterFolders();
  return NextResponse.json({ masters });
}

export async function POST(req: Request) {
  await connectToDatabase();
  const body = (await req.json().catch(() => null)) as { name?: string } | null;
  const name = body?.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const master = await createMasterFolder(name);
  return NextResponse.json({ ok: true, master });
}
