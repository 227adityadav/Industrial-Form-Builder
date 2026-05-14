"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { readStableSubmissionIdFromBody } from "@/lib/submission-identifiers";
import type { SubmissionRecord } from "@/types/submission";
import { normalizeSubmissionStatus } from "@/types/submission";

type TemplateRecord = { id: string; name: string };

function byUpdatedDesc(a: SubmissionRecord, b: SubmissionRecord) {
  const ta = new Date(a.updatedAt ?? a.submittedAt).getTime();
  const tb = new Date(b.updatedAt ?? b.submittedAt).getTime();
  return tb - ta;
}

function submissionsQueryFromSearchParams(searchParams: URLSearchParams): string {
  const folderId = searchParams.get("folderId");
  const templateId = searchParams.get("templateId");
  const q = new URLSearchParams();
  if (folderId) q.set("folderId", folderId);
  if (templateId) q.set("templateId", templateId);
  const s = q.toString();
  return s ? `?${s}` : "";
}

function historyBackHref(searchParams: URLSearchParams): { href: string; label: string } {
  const folderId = searchParams.get("folderId");
  const templateId = searchParams.get("templateId");
  if (folderId && templateId) {
    return {
      href: `/forms/${encodeURIComponent(templateId)}?folderId=${encodeURIComponent(folderId)}`,
      label: "← Back to form",
    };
  }
  if (folderId) {
    return { href: `/forms/folder/${encodeURIComponent(folderId)}`, label: "← Back to folder" };
  }
  if (templateId) {
    return { href: `/forms/${encodeURIComponent(templateId)}`, label: "← Open form" };
  }
  return { href: "/forms", label: "← All folders" };
}

export default function FormHistoryPage() {
  const searchParams = useSearchParams();
  const [submissions, setSubmissions] = React.useState<SubmissionRecord[]>([]);
  const [templates, setTemplates] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);

  async function load() {
    setLoading(true);
    const subQs = submissionsQueryFromSearchParams(searchParams);
    const [subRes, tRes] = await Promise.all([
      fetch(`/api/submissions${subQs}`, { cache: "no-store" }),
      fetch("/api/templates", { cache: "no-store" }),
    ]);
    const data = (await subRes.json()) as { submissions?: SubmissionRecord[] };
    const tData = (await tRes.json()) as { templates?: TemplateRecord[] };
    const sorted = [...(data.submissions ?? [])].sort(byUpdatedDesc);
    setSubmissions(sorted);
    setTemplates(Object.fromEntries((tData.templates ?? []).map((t) => [t.id, t.name])));
    setLoading(false);
  }

  React.useEffect(() => {
    void load();
  }, [searchParams]);

  const scoped =
    Boolean(searchParams.get("folderId")) || Boolean(searchParams.get("templateId"));
  const back = historyBackHref(searchParams);
  const historyScopeForView = submissionsQueryFromSearchParams(searchParams);
  const description = scoped
    ? "Newest first for this view. Only your most recent submission in this list can be edited (including when it is already final). Open history from a folder or form to limit what appears here."
    : "Newest first across all folders and forms. Only your single most recent submission overall can be edited — including when it is already a final submission.";

  return (
    <div className="app-page">
      <PageHeader maxWidth="5xl" title="View history" description={description}>
        <Link className="ui-btn-secondary" href={back.href}>
          {back.label}
        </Link>
        <button className="ui-btn-secondary" type="button" onClick={() => void load()}>
          Refresh
        </button>
      </PageHeader>

      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        {loading ? (
          <div className="ui-placeholder">Loading…</div>
        ) : submissions.length === 0 ? (
          <div className="ui-placeholder">
            {scoped
              ? "No submissions match this folder or form yet."
              : "No submissions yet."}
          </div>
        ) : (
          <ul className="space-y-3">
            {submissions.map((s, index) => {
              const isMostRecent = index === 0;
              const status = normalizeSubmissionStatus(s);
              const sid = readStableSubmissionIdFromBody(s) ?? s.id;
              const folderQ = s.folderId ? `&folderId=${encodeURIComponent(s.folderId)}` : "";
              const entryHref = sid
                ? `/forms/${encodeURIComponent(s.templateId)}?submissionId=${encodeURIComponent(sid)}${folderQ}`
                : "#";
              const viewHref = sid
                ? `/forms/view/${encodeURIComponent(sid)}${historyScopeForView}`
                : "#";
              const canEdit = isMostRecent;
              const snapTitle =
                s.templateSnapshot?.id === s.templateId ? s.templateSnapshot?.name?.trim() : "";
              const displayName = snapTitle || templates[s.templateId] || s.templateId;

              return (
                <li
                  key={`${sid || "row"}-${s.templateId}-${index}`}
                  className="flex flex-col gap-3 rounded-xl border border-zinc-200/90 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-semibold text-zinc-900">{displayName}</div>
                    <div className="mt-1 text-sm text-zinc-600">
                      Updated {new Date(s.updatedAt ?? s.submittedAt).toLocaleString()}
                    </div>
                    <div className="mt-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          status === "ongoing"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-emerald-100 text-emerald-900"
                        }`}
                      >
                        {status === "ongoing" ? "Ongoing submission" : "Final submission"}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {canEdit ? (
                      <Link className="ui-btn-primary px-4 py-2 text-sm" href={entryHref}>
                        Edit
                      </Link>
                    ) : (
                      <Link className="ui-btn-secondary px-4 py-2 text-sm" href={viewHref}>
                        View
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
