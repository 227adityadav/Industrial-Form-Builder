import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/session";
import { buildSubmissionPdfBytes, submissionPdfFilename } from "@/lib/submission-pdf";
import type { SubmissionRecord } from "@/types/submission";
import { normalizeSubmissionStatus } from "@/types/submission";
import { connectToDatabase } from "@/lib/db/connection";
import { getSubmissionById, getTemplateById } from "@/lib/db/content";
import { normalizeFormSchema } from "@/lib/form-schema-normalize";
import type { FormSchema } from "@/types/form-schema";

export const dynamic = "force-dynamic";

type TemplateRecord = FormSchema & { updatedAt: string; createdAt: string };

function coerceRecord(raw: SubmissionRecord): SubmissionRecord {
  const submittedAt = raw.submittedAt;
  return {
    ...raw,
    submittedAt,
    updatedAt: raw.updatedAt ?? submittedAt,
    submissionStatus: normalizeSubmissionStatus(raw),
  };
}

function canUserReadSubmission(session: { role: string | null; username: string | null }, s: SubmissionRecord) {
  if (session.role === "manager" || session.role === "dashboard") return true;
  if (session.role === "user" && session.username && s.username === session.username) return true;
  return false;
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

  const found =
    submission.templateSnapshot?.id === submission.templateId
      ? submission.templateSnapshot
      : ((await getTemplateById(submission.templateId)) as TemplateRecord | null);
  if (!found) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  const template = normalizeFormSchema(found);

  const bytes = buildSubmissionPdfBytes(submission, template);
  const filename = submissionPdfFilename(template.name, submission.id);

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
