import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connection";
import {
  listFoldersNormalized,
  listSubmissionsAll,
  listTemplatesNormalized,
  saveSubmissionsInOrder,
} from "@/lib/db/content";
import { repairSubmissionRecords } from "@/lib/db/submission-repair";
import { getAuthSession } from "@/lib/session";
import { dbErrorMessage } from "@/lib/db/error-message";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const session = await getAuthSession();
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as { dryRun?: boolean } | null;
    const dryRun = body?.dryRun !== false;

    const [submissions, templates, folders] = await Promise.all([
      listSubmissionsAll(),
      listTemplatesNormalized(),
      listFoldersNormalized(),
    ]);
    const repaired = repairSubmissionRecords(submissions, templates, folders);

    if (!dryRun) {
      await saveSubmissionsInOrder(repaired.records);
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      summary: repaired.summary,
    });
  } catch (error) {
    return NextResponse.json({ error: dbErrorMessage(error) }, { status: 500 });
  }
}
