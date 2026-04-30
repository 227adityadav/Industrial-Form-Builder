import { NextResponse } from "next/server";
import type { FormSchema, Id } from "@/types/form-schema";
import type { RevealFillInstance, SubmissionRecord, SubmissionStatus } from "@/types/submission";
import { normalizeSubmissionStatus } from "@/types/submission";
import { normalizeFormSchema } from "@/lib/form-schema-normalize";
import { mergeUserGridWithTemplateLocks } from "@/lib/grid-template-locks";
import { mergeRevealFillGridsForOperator, sanitizeRevealFills } from "@/lib/reveal-fills";
import { getAuthSession } from "@/lib/session";
import { upsertRefillNotificationForSubmission } from "@/lib/refill-notification-service";
import { connectToDatabase } from "@/lib/db/connection";
import { randomUuid } from "@/lib/random-uuid";
import {
  getFolderById,
  getTemplateById,
  insertSubmission,
  listSubmissionsAll,
} from "@/lib/db/content";
import { dbErrorMessage } from "@/lib/db/error-message";
import { ensureTemplateAllowedInFolder, isPlainRecord } from "@/lib/flow-validation";

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

export async function GET(req: Request) {
  try {
    await connectToDatabase();
    const session = await getAuthSession();
    if (!session.role || session.role === "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get("folderId") ?? undefined;
    const templateId = searchParams.get("templateId") ?? undefined;
    const submissionStatus = searchParams.get("submissionStatus") as SubmissionStatus | null;
    const filterUsername = searchParams.get("username") ?? undefined;
    const limitRaw = searchParams.get("limit");
    let limitN: number | undefined;
    if (limitRaw !== null && limitRaw !== "") {
      const n = parseInt(limitRaw, 10);
      if (Number.isFinite(n) && n > 0) {
        limitN = Math.min(500, n);
      }
    }

    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const fromMs = fromParam ? Date.parse(fromParam) : NaN;
    const toMs = toParam ? Date.parse(toParam) : NaN;

    const submissions = (await listSubmissionsAll())
      .map(coerceRecord)
      .filter((s): s is SubmissionRecord => s !== null);

    let filtered = submissions;

    if (session.role === "user") {
      if (!session.username) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      filtered = filtered.filter((s) => s.username === session.username);
      if (folderId) filtered = filtered.filter((s) => s.folderId === folderId);
      if (templateId) filtered = filtered.filter((s) => s.templateId === templateId);
      if (submissionStatus === "ongoing" || submissionStatus === "final") {
        filtered = filtered.filter((s) => normalizeSubmissionStatus(s) === submissionStatus);
      }
      if (!Number.isNaN(fromMs)) {
        filtered = filtered.filter((s) => new Date(s.updatedAt ?? s.submittedAt).getTime() >= fromMs);
      }
      if (!Number.isNaN(toMs)) {
        filtered = filtered.filter((s) => new Date(s.updatedAt ?? s.submittedAt).getTime() <= toMs);
      }
    } else if (session.role === "manager" || session.role === "dashboard") {
      if (folderId) filtered = filtered.filter((s) => s.folderId === folderId);
      if (templateId) filtered = filtered.filter((s) => s.templateId === templateId);
      if (filterUsername) filtered = filtered.filter((s) => s.username === filterUsername);
      if (submissionStatus === "ongoing" || submissionStatus === "final") {
        filtered = filtered.filter((s) => normalizeSubmissionStatus(s) === submissionStatus);
      }
      if (!Number.isNaN(fromMs)) {
        filtered = filtered.filter((s) => new Date(s.updatedAt ?? s.submittedAt).getTime() >= fromMs);
      }
      if (!Number.isNaN(toMs)) {
        filtered = filtered.filter((s) => new Date(s.updatedAt ?? s.submittedAt).getTime() <= toMs);
      }
    }

    if (limitN !== undefined) {
      const byRecency = (a: (typeof filtered)[0], b: (typeof filtered)[0]) => {
        const ta = new Date(a.updatedAt ?? a.submittedAt).getTime();
        const tb = new Date(b.updatedAt ?? b.submittedAt).getTime();
        return tb - ta;
      };
      filtered = [...filtered].sort(byRecency).slice(0, limitN);
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
    if ((session.role !== "user" && session.role !== "manager") || !session.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as
      | {
          templateId?: Id;
          folderId?: string;
          username?: string;
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

    const latestTemplate = await loadTemplate(body.templateId);
    if (!latestTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 400 });
    }
    const folder =
      typeof body.folderId === "string" && body.folderId.trim().length > 0
        ? await getFolderById(body.folderId)
        : null;
    if (body.folderId && !folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 400 });
    }
    const folderTemplateError = ensureTemplateAllowedInFolder(folder, body.templateId);
    if (folderTemplateError) {
      return NextResponse.json({ error: folderTemplateError }, { status: 400 });
    }

    const status: SubmissionStatus = body.submissionStatus === "ongoing" ? "ongoing" : "final";
    const now = new Date().toISOString();
    const templateForSubmission = latestTemplate;
    const grid =
      session.role === "user"
        ? mergeUserGridWithTemplateLocks(body.grid ?? null, templateForSubmission)
        : body.grid ?? null;
    const revealFillsRaw = body.revealFills;
    const revealFills =
      session.role === "user"
        ? mergeRevealFillGridsForOperator(
            sanitizeRevealFills(revealFillsRaw, templateForSubmission),
            templateForSubmission
          )
        : sanitizeRevealFills(revealFillsRaw, templateForSubmission);
    const record: SubmissionRecord = {
      id: randomUuid(),
      templateId: body.templateId,
      templateSnapshot: templateForSubmission,
      folderId: body.folderId,
      username: session.username,
      submittedAt: now,
      updatedAt: now,
      submissionStatus: status,
      top: body.top ?? {},
      grid,
      footer: body.footer ?? {},
      revealFills: revealFills.length ? revealFills : undefined,
    };
    await insertSubmission(record);
    if (status === "final") {
      await upsertRefillNotificationForSubmission(record);
    }
    return NextResponse.json({ ok: true, submission: record });
  } catch (error) {
    return NextResponse.json({ error: dbErrorMessage(error) }, { status: 500 });
  }
}
