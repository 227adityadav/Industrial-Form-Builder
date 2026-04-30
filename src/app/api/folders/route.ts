import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connection";
import { listFoldersNormalized, listTemplatesNormalized, upsertFolder } from "@/lib/db/content";
import { normalizeIdList, validateFolderSchedule } from "@/lib/flow-validation";
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
  const normalizedTemplateIds =
    body.templateIds === undefined ? undefined : normalizeIdList(body.templateIds);
  if (body.templateIds !== undefined && normalizedTemplateIds === null) {
    return NextResponse.json({ error: "templateIds must be a non-empty string array" }, { status: 400 });
  }
  const normalizedAllowedUsers =
    body.allowedUsernames === undefined ? undefined : normalizeIdList(body.allowedUsernames);
  if (body.allowedUsernames !== undefined && normalizedAllowedUsers === null) {
    return NextResponse.json({ error: "allowedUsernames must be a non-empty string array" }, { status: 400 });
  }
  const normalizedMasterIds =
    body.masterFolderIds === undefined ? undefined : normalizeIdList(body.masterFolderIds);
  if (body.masterFolderIds !== undefined && normalizedMasterIds === null) {
    return NextResponse.json({ error: "masterFolderIds must be a non-empty string array" }, { status: 400 });
  }
  const templateIdsForSave = normalizedTemplateIds ?? undefined;
  const allowedUsersForSave = normalizedAllowedUsers ?? undefined;
  const masterIdsForSave = normalizedMasterIds ?? undefined;

  const scheduleError = validateFolderSchedule({
    nextFillDueHours: body.nextFillDueHours,
    nextFillDueDays: body.nextFillDueDays,
    nextFillDueTime: body.nextFillDueTime,
  });
  if (scheduleError) {
    return NextResponse.json({ error: scheduleError }, { status: 400 });
  }

  if (normalizedTemplateIds && normalizedTemplateIds.length > 0) {
    const templates = await listTemplatesNormalized();
    const templateSet = new Set(templates.map((t) => t.id));
    const missing = normalizedTemplateIds.find((id) => !templateSet.has(id));
    if (missing) {
      return NextResponse.json({ error: `Unknown template id: ${missing}` }, { status: 400 });
    }
  }
  const folder = await upsertFolder({
    id: body.id,
    name: body.name,
    templateIds: templateIdsForSave,
    allowedUsernames: allowedUsersForSave,
    masterFolderIds: masterIdsForSave,
    nextFillDueHours: body.nextFillDueHours,
    nextFillDueDays: body.nextFillDueDays,
    nextFillDueTime: body.nextFillDueTime,
  });
  return NextResponse.json({ ok: true, folder });
}
