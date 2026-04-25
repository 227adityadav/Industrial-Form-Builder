import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connection";
import { listFoldersNormalized, upsertFolder } from "@/lib/db/content";
import { getAuthSession } from "@/lib/session";
import type { FolderRecord } from "@/types/folder";

export const dynamic = "force-dynamic";

function folderAllowsUsername(f: FolderRecord, username: string): boolean {
  const u = username.toLowerCase();
  return (f.allowedUsernames ?? []).some((a) => a.toLowerCase() === u);
}

export async function GET() {
  await connectToDatabase();
  const session = await getAuthSession();
  if (!session.role) {
    return NextResponse.json({ folders: [] });
  }

  let folders = await listFoldersNormalized();
  if (session.role === "user") {
    if (!session.username) {
      folders = [];
    } else {
      folders = folders.filter((f) => folderAllowsUsername(f, session.username!));
    }
  }
  return NextResponse.json({ folders });
}

export async function POST(req: Request) {
  await connectToDatabase();
  const body = (await req.json().catch(() => null)) as
    | {
        id?: string;
        name?: string;
        templateIds?: string[];
        allowedUsernames?: string[];
        masterFolderIds?: string[];
        nextFillDueHours?: number | null;
        nextFillDueDays?: number | null;
        nextFillDueTime?: string | null;
      }
    | null;
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "Folder name is required" }, { status: 400 });
  }
  const folder = await upsertFolder({
    id: body.id,
    name: body.name,
    templateIds: body.templateIds,
    allowedUsernames: body.allowedUsernames,
    masterFolderIds: body.masterFolderIds,
    nextFillDueHours: body.nextFillDueHours,
    nextFillDueDays: body.nextFillDueDays,
    nextFillDueTime: body.nextFillDueTime,
  });
  return NextResponse.json({ ok: true, folder });
}
