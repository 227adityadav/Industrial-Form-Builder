import { NextResponse } from "next/server";
import type { FormSchema } from "@/types/form-schema";
import type { RevealFillInstance, SubmissionRecord, SubmissionStatus } from "@/types/submission";
import { normalizeSubmissionStatus } from "@/types/submission";
import { normalizeFormSchema } from "@/lib/form-schema-normalize";
import { mergeUserGridWithTemplateLocks } from "@/lib/grid-template-locks";
import { mergeRevealFillGridsForOperator, sanitizeRevealFills } from "@/lib/reveal-fills";
import { getAuthSession } from "@/lib/session";
import { upsertRefillNotificationForSubmission } from "@/lib/refill-notification-service";
import { connectToDatabase } from "@/lib/db/connection";
import { getTemplateById, getSubmissionById, listSubmissionsAll, updateSubmissionById } from "@/lib/db/content";
import { isPlainRecord } from "@/lib/flow-validation";

export const dynamic = "force-dynamic";

async function loadTemplate(templateId: string): Promise<FormSchema | null> {
  const raw = await getTemplateById(templateId);
  return raw ? normalizeFormSchema(raw) : null;
}

function readSubmissionId(raw: SubmissionRecord): string | null {
  if (typeof raw.id === "string" && raw.id.trim().length > 0) {
    return raw.id.trim();
  }
  const legacy = (raw as unknown as { _id?: unknown })._id;
  if (typeof legacy === "string" && legacy.trim().length > 0) {
    return legacy.trim();
  }
  return null;
}

function coerceRecord(raw: SubmissionRecord): SubmissionRecord | null {
  const id = readSubmissionId(raw);
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

function canUserReadSubmission(session: { role: string | null; username: string | null }, s: SubmissionRecord) {
  if (session.role === "manager" || session.role === "dashboard") return true;
  if (session.role === "user" && session.username && s.username === session.username) return true;
  return false;
}

function byUpdatedDesc(a: SubmissionRecord, b: SubmissionRecord) {
  const ta = new Date(a.updatedAt ?? a.submittedAt).getTime();
  const tb = new Date(b.updatedAt ?? b.submittedAt).getTime();
  return tb - ta;
}

/** Final submissions may only be updated when they are the operator’s single newest record; ongoing drafts stay editable. */
function isUsersMostRecentSubmission(all: SubmissionRecord[], current: SubmissionRecord): boolean {
  const mine = all.filter((s) => s.username === current.username);
  if (mine.length === 0) return false;
  const sorted = [...mine].sort(byUpdatedDesc);
  return sorted[0].id === current.id;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase();
  const session = await getAuthSession();
  if (!session.role || session.role === "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const raw = await getSubmissionById(id);
  const submission = raw ? coerceRecord(raw) : null;
  if (!submission) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canUserReadSubmission(session, submission)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ submission });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase();
  const session = await getAuthSession();
  if ((session.role !== "user" && session.role !== "manager") || !session.username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
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

  const submissions = (await listSubmissionsAll())
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

  const latestTemplate = await loadTemplate(current.templateId);
  const templateForSubmission = current.templateSnapshot ?? latestTemplate;
  const rawGrid = body?.grid !== undefined ? body.grid : current.grid;
  const grid =
    session.role === "user" && templateForSubmission
      ? mergeUserGridWithTemplateLocks(rawGrid, templateForSubmission)
      : rawGrid;

  const revealSource = body?.revealFills !== undefined ? body.revealFills : current.revealFills;
  const revealSanitized = templateForSubmission ? sanitizeRevealFills(revealSource, templateForSubmission) : [];
  const revealFills =
    session.role === "user" && templateForSubmission
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

  await updateSubmissionById(updated);
  if (nextStatus === "final") {
    await upsertRefillNotificationForSubmission(updated);
  }
  return NextResponse.json({ ok: true, submission: updated });
}
