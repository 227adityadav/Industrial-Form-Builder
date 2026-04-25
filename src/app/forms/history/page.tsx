"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import type { SubmissionRecord } from "@/types/submission";
import { normalizeSubmissionStatus } from "@/types/submission";

type TemplateRecord = { id: string; name: string };

function byUpdatedDesc(a: SubmissionRecord, b: SubmissionRecord) {
  const ta = new Date(a.updatedAt ?? a.submittedAt).getTime();
  const tb = new Date(b.updatedAt ?? b.submittedAt).getTime();
  return tb - ta;
}

export default function FormHistoryPage() {
  const [submissions, setSubmissions] = React.useState<SubmissionRecord[]>([]);
  const [templates, setTemplates] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);

  async function load() {
    setLoading(true);
    const [subRes, tRes] = await Promise.all([
      fetch("/api/submissions", { cache: "no-store" }),
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
  }, []);

  return (
    <div className="app-page">
      <PageHeader
        maxWidth="5xl"
        title="View history"
        description="Newest first. Only your most recent submission can be edited — including when it is already a final submission."
      >
        <Link className="ui-btn-secondary" href="/forms">
          ← All folders
        </Link>
        <button className="ui-btn-secondary" type="button" onClick={() => void load()}>
          Refresh
        </button>
      </PageHeader>

      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        {loading ? (
          <div className="ui-placeholder">Loading…</div>
        ) : submissions.length === 0 ? (
          <div className="ui-placeholder">No submissions yet.</div>
        ) : (
          <ul className="space-y-3">
            {submissions.map((s, index) => {
              const isMostRecent = index === 0;
              const status = normalizeSubmissionStatus(s);
              const folderQ = s.folderId ? `&folderId=${encodeURIComponent(s.folderId)}` : "";
              const editHref = `/forms/${s.templateId}?submissionId=${encodeURIComponent(s.id)}${folderQ}`;
              const canEdit = isMostRecent;

              return (
                <li
                  key={s.id}
                  className="flex flex-col gap-3 rounded-xl border border-zinc-200/90 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-semibold text-zinc-900">{templates[s.templateId] ?? s.templateId}</div>
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
                      <a className="ui-btn-primary px-4 py-2 text-sm" href={editHref}>
                        Edit
                      </a>
                    ) : null}
                    <a className="ui-btn-secondary px-4 py-2 text-sm" href={`/forms/view/${s.id}`}>
                      View
                    </a>
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
