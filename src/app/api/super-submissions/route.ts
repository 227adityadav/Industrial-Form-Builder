import { NextResponse } from "next/server";
import type { FormSchema, Id } from "@/types/form-schema";
import type { RevealFillInstance, SubmissionRecord, SubmissionStatus } from "@/types/submission";
import { normalizeSubmissionStatus } from "@/types/submission";
import { normalizeFormSchema } from "@/lib/form-schema-normalize";
import { mergeUserGridWithTemplateLocks } from "@/lib/grid-template-locks";
import { mergeRevealFillGridsForOperator, sanitizeRevealFills } from "@/lib/reveal-fills";
import { getAuthSession } from "@/lib/session";
import { connectToDatabase } from "@/lib/db/connection";
import { getSuperTemplateById } from "@/lib/db/super-content";
import {
  insertSuperSubmission,
  listSuperSubmissionsAll,
} from "@/lib/db/super-submissions";
import { dbErrorMessage } from "@/lib/db/error-message";
import { isPlainRecord } from "@/lib/flow-validation";
import { readStableSubmissionIdFromBody } from "@/lib/submission-identifiers";
import { randomUuid } from "@/lib/random-uuid";

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

export async function GET(req: Request) {
  try {
    await connectToDatabase();
    const session = await getAuthSession();
    if (session.role !== "superoperator") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!session.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const templateId = searchParams.get("templateId") ?? undefined;
    const submissionStatus = searchParams.get("submissionStatus") as SubmissionStatus | null;
    const limitRaw = searchParams.get("limit");
    let limitN: number | undefined;
    if (limitRaw !== null && limitRaw !== "") {
      const n = parseInt(limitRaw, 10);
      if (Number.isFinite(n) && n > 0) {
        limitN = Math.min(500, n);
      }
    }

    const submissions = (await listSuperSubmissionsAll())
      .map(coerceRecord)
      .filter((s): s is SubmissionRecord => s !== null);

    let filtered = submissions.filter((s) => s.username === session.username);
    if (templateId) filtered = filtered.filter((s) => s.templateId === templateId);
    if (submissionStatus === "ongoing" || submissionStatus === "final") {
      filtered = filtered.filter((s) => normalizeSubmissionStatus(s) === submissionStatus);
    }

    const byRecency = (a: SubmissionRecord, b: SubmissionRecord) => {
      const ta = new Date(a.updatedAt ?? a.submittedAt).getTime();
      const tb = new Date(b.updatedAt ?? b.submittedAt).getTime();
      return tb - ta;
    };
    filtered = [...filtered].sort(byRecency);
    if (limitN !== undefined) {
      filtered = filtered.slice(0, limitN);
    }

    return NextResponse.json({ submissions: filtered });
  } catch (error) {
    return NextResponse.json({ error: dbErrorMessage(error) }, { status: 503 });
  }
}

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const session = await getAuthSession();
    if (session.role !== "superoperator" || !session.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as
      | {
          templateId?: Id;
          top?: Record<string, unknown>;
          grid?: unknown;
          footer?: Record<string, unknown>;
          revealFills?: RevealFillInstance[];
          submissionStatus?: SubmissionStatus;
        }
      | null;

    if (!body?.templateId) {
      return NextResponse.json({ error: "Missing templateId" }, { status: 400 });
    }
    if (body.top !== undefined && !isPlainRecord(body.top)) {
      return NextResponse.json({ error: "top must be an object" }, { status: 400 });
    }
    if (body.footer !== undefined && !isPlainRecord(body.footer)) {
      return NextResponse.json({ error: "footer must be an object" }, { status: 400 });
    }
    if (body.revealFills !== undefined && !Array.isArray(body.revealFills)) {
      return NextResponse.json({ error: "revealFills must be an array" }, { status: 400 });
    }

    const latestTemplate = await loadSuperTemplate(body.templateId);
    if (!latestTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 400 });
    }

    const status: SubmissionStatus = body.submissionStatus === "ongoing" ? "ongoing" : "final";
    const now = new Date().toISOString();
    const grid = mergeUserGridWithTemplateLocks(body.grid ?? null, latestTemplate);
    const revealFills = mergeRevealFillGridsForOperator(
      sanitizeRevealFills(body.revealFills, latestTemplate),
      latestTemplate
    );
    const record: SubmissionRecord = {
      id: randomUuid(),
      templateId: body.templateId,
      templateSnapshot: latestTemplate,
      username: session.username,
      submittedAt: now,
      updatedAt: now,
      submissionStatus: status,
      top: body.top ?? {},
      grid,
      footer: body.footer ?? {},
      revealFills: revealFills.length ? revealFills : undefined,
    };
    await insertSuperSubmission(record);
    return NextResponse.json({ ok: true, submission: record });
  } catch (error) {
    return NextResponse.json({ error: dbErrorMessage(error) }, { status: 500 });
  }
}
