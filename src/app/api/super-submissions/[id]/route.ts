import { NextResponse } from "next/server";
import type { FormSchema } from "@/types/form-schema";
import type { RevealFillInstance, SubmissionRecord, SubmissionStatus } from "@/types/submission";
import { normalizeSubmissionStatus } from "@/types/submission";
import { normalizeFormSchema } from "@/lib/form-schema-normalize";
import { mergeUserGridWithTemplateLocks } from "@/lib/grid-template-locks";
import { mergeRevealFillGridsForOperator, sanitizeRevealFills } from "@/lib/reveal-fills";
import { getAuthSession } from "@/lib/session";
import { connectToDatabase } from "@/lib/db/connection";
import { getSuperTemplateById } from "@/lib/db/super-content";
import {
  getSuperSubmissionById,
  listSuperSubmissionsAll,
  updateSuperSubmissionById,
} from "@/lib/db/super-submissions";
import { isPlainRecord } from "@/lib/flow-validation";
import { readStableSubmissionIdFromBody } from "@/lib/submission-identifiers";

export const dynamic = "force-dynamic";

async function loadSuperTemplate(templateId: string): Promise<FormSchema | null> {
  const raw = await getSuperTemplateById(templateId);
  return raw ? normalizeFormSchema(raw) : null;
}

function coerceRecord(raw: SubmissionRecord): SubmissionRecord | null {
  const id = readStableSubmissionIdFromBody(raw);
  if (!id) return null;
  const submittedAt = raw.submittedAt;
  const revealFills = Array.isArray(raw.revealFills)
    ? (raw.revealFills as RevealFillInstance[])
    : undefined;
  return {
    id,
    templateId: raw.templateId,
    templateSnapshot: raw.templateSnapshot,
    folderId: raw.folderId,
    username: raw.username,
    submittedAt,
    updatedAt: raw.updatedAt ?? submittedAt,
    submissionStatus: normalizeSubmissionStatus(raw),
    top: raw.top ?? {},
    grid: raw.grid ?? null,
    footer: raw.footer ?? {},
    revealFills,
  };
}

function byUpdatedDesc(a: SubmissionRecord, b: SubmissionRecord) {
  const ta = new Date(a.updatedAt ?? a.submittedAt).getTime();
  const tb = new Date(b.updatedAt ?? b.submittedAt).getTime();
  return tb - ta;
}

function isUsersMostRecentSubmission(all: SubmissionRecord[], current: SubmissionRecord): boolean {
  const mine = all.filter((s) => s.username === current.username);
  if (mine.length === 0) return false;
  const sorted = [...mine].sort(byUpdatedDesc);
  return sorted[0].id === current.id;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase();
  const session = await getAuthSession();
  if (session.role !== "superoperator") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawParam } = await params;
  const id = decodeURIComponent(rawParam).trim();
  const raw = await getSuperSubmissionById(id);
  const submission = raw ? coerceRecord(raw) : null;
  if (!submission) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (submission.username !== session.username) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ submission });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase();
  const session = await getAuthSession();
  if (session.role !== "superoperator" || !session.username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawPatchId } = await params;
  const id = decodeURIComponent(rawPatchId).trim();
  const body = (await req.json().catch(() => null)) as
    | {
        top?: Record<string, unknown>;
        grid?: unknown;
        footer?: Record<string, unknown>;
        revealFills?: RevealFillInstance[];
        submissionStatus?: SubmissionStatus;
      }
    | null;
  if (body?.top !== undefined && !isPlainRecord(body.top)) {
    return NextResponse.json({ error: "top must be an object" }, { status: 400 });
  }
  if (body?.footer !== undefined && !isPlainRecord(body.footer)) {
    return NextResponse.json({ error: "footer must be an object" }, { status: 400 });
  }
  if (body?.revealFills !== undefined && !Array.isArray(body.revealFills)) {
    return NextResponse.json({ error: "revealFills must be an array" }, { status: 400 });
  }

  const submissions = (await listSuperSubmissionsAll())
    .map(coerceRecord)
    .filter((s): s is SubmissionRecord => s !== null);
  const idx = submissions.findIndex((s) => s.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const current = submissions[idx]!;
  if (current.username !== session.username) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (normalizeSubmissionStatus(current) === "final") {
    if (!isUsersMostRecentSubmission(submissions, current)) {
      return NextResponse.json(
        { error: "Only your most recent submission can be edited. Older final submissions are read-only." },
        { status: 403 }
      );
    }
  }

  const now = new Date().toISOString();
  const nextStatus: SubmissionStatus =
    body?.submissionStatus === "final" || body?.submissionStatus === "ongoing"
      ? body.submissionStatus
      : normalizeSubmissionStatus(current);

  const latestTemplate = await loadSuperTemplate(current.templateId);
  const templateForSubmission = current.templateSnapshot ?? latestTemplate;
  const rawGrid = body?.grid !== undefined ? body.grid : current.grid;
  const grid =
    templateForSubmission && rawGrid !== undefined
      ? mergeUserGridWithTemplateLocks(rawGrid, templateForSubmission)
      : rawGrid;

  const revealSource = body?.revealFills !== undefined ? body.revealFills : current.revealFills;
  const revealSanitized = templateForSubmission ? sanitizeRevealFills(revealSource, templateForSubmission) : [];
  const revealFills = templateForSubmission
    ? mergeRevealFillGridsForOperator(revealSanitized, templateForSubmission)
    : revealSanitized;

  const updated: SubmissionRecord = {
    ...current,
    top: body?.top ?? current.top,
    grid,
    footer: body?.footer ?? current.footer,
    revealFills: revealFills.length ? revealFills : undefined,
    submissionStatus: nextStatus,
    updatedAt: now,
    templateSnapshot: templateForSubmission ?? current.templateSnapshot,
  };

  await updateSuperSubmissionById(updated);
  return NextResponse.json({ ok: true, submission: updated });
}
