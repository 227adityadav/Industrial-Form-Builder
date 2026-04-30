"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import type { SubmissionRecord } from "@/types/submission";
import { normalizeSubmissionStatus } from "@/types/submission";

type TemplateRecord = { id: string; name: string };

export default function OngoingFormsPage() {
  const [submissions, setSubmissions] = React.useState<SubmissionRecord[]>([]);
  const [templates, setTemplates] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);

  async function load() {
    setLoading(true);
    const [subRes, tRes] = await Promise.all([
      fetch("/api/submissions?submissionStatus=ongoing", { cache: "no-store" }),
      fetch("/api/templates", { cache: "no-store" }),
    ]);
    const data = (await subRes.json()) as { submissions?: SubmissionRecord[] };
    const tData = (await tRes.json()) as { templates?: TemplateRecord[] };
    const ongoing = (data.submissions ?? []).filter(
      (s) =>
        normalizeSubmissionStatus(s) === "ongoing" &&
        typeof s.templateId === "string" &&
        s.templateId.trim().length > 0
    );
    const sorted = [...ongoing].sort(
      (a, b) =>
        new Date(b.updatedAt ?? b.submittedAt).getTime() -
        new Date(a.updatedAt ?? a.submittedAt).getTime()
    );
    setSubmissions(sorted);
    setTemplates(Object.fromEntries((tData.templates ?? []).map((t) => [t.id, t.name])));
    setLoading(false);
  }

  function displayFormName(s: SubmissionRecord): string {
    const snapName = s.templateSnapshot?.name?.trim();
    if (snapName) return snapName;
    return templates[s.templateId] ?? s.templateId;
  }

  React.useEffect(() => {
    void load();
  }, []);

  return (
    <div className="app-page">
      <PageHeader
        maxWidth="5xl"
        title="Ongoing"
        description="Drafts saved as ongoing submission. Open a form to edit, then submit as final when ready."
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
          <div className="ui-placeholder">No ongoing forms. Use “Ongoing submission” when filling a form to save a draft here.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {submissions.map((s) => {
              const folderQ = s.folderId ? `&folderId=${encodeURIComponent(s.folderId)}` : "";
              return (
                <a
                  key={s.id}
                  href={`/forms/${s.templateId}?submissionId=${encodeURIComponent(s.id)}${folderQ}`}
                  className="group ui-card transition-all hover:-translate-y-0.5 hover:border-zinc-300/90 hover:shadow-md"
                >
                  <div className="text-base font-semibold text-zinc-900">{displayFormName(s)}</div>
                  <div className="mt-2 text-sm text-zinc-600">
                    Updated {new Date(s.updatedAt ?? s.submittedAt).toLocaleString()}
                  </div>
                  <span className="mt-4 inline-block text-sm font-medium text-emerald-800 group-hover:underline">
                    Continue editing →
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
