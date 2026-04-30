"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import type { FolderRecord } from "@/types/folder";
import { PageHeader } from "@/components/ui/PageHeader";
import { RefillNotificationsBell } from "@/components/notifications/RefillNotificationsBell";

type Submission = {
  id: string;
  templateId: string;
  templateSnapshot?: { name?: string };
  folderId?: string;
  username?: string;
  submittedAt: string;
  updatedAt?: string;
  submissionStatus?: "ongoing" | "final";
};

type TemplateRecord = { id: string; name: string };

function displayFormName(
  submission: Submission,
  templateMap: Record<string, string>
): string {
  const snapName = submission.templateSnapshot?.name?.trim();
  if (snapName) return snapName;
  return templateMap[submission.templateId] ?? submission.templateId;
}

export default function DashboardFolderPage() {
  const { folderId } = useParams<{ folderId: string }>();
  const [folder, setFolder] = React.useState<FolderRecord | null>(null);
  const [submissions, setSubmissions] = React.useState<Submission[]>([]);
  const [templateMap, setTemplateMap] = React.useState<Record<string, string>>({});
  const [activeUser, setActiveUser] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function load() {
      const [foldersRes, submissionsRes, templatesRes] = await Promise.all([
        fetch("/api/folders", { cache: "no-store" }),
        fetch(`/api/submissions?folderId=${folderId}`, { cache: "no-store" }),
        fetch("/api/templates", { cache: "no-store" }),
      ]);
      const foldersData = (await foldersRes.json()) as { folders: FolderRecord[] };
      const submissionsData = (await submissionsRes.json()) as { submissions: Submission[] };
      const templatesData = (await templatesRes.json()) as { templates: TemplateRecord[] };
      setFolder((foldersData.folders ?? []).find((f) => f.id === folderId) ?? null);
      setSubmissions(submissionsData.submissions ?? []);
      setTemplateMap(Object.fromEntries((templatesData.templates ?? []).map((t) => [t.id, t.name])));
    }
    void load();
  }, [folderId]);

  return (
    <div className="app-page">
      <PageHeader
        title={folder?.name ?? "Folder"}
        description="Submissions recorded for this folder. PDF downloads use the same export as Manager."
      >
        <RefillNotificationsBell />
        <a className="ui-btn-secondary" href="/dashboard">
          ← Overview
        </a>
      </PageHeader>
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        {submissions.length === 0 ? (
          <div className="ui-placeholder">No submitted forms in this folder yet.</div>
        ) : (
          <div className="space-y-6">
            <section className="ui-card">
              <h2 className="ui-section-title">Filter by operator</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {[...new Set(submissions.map((s) => s.username ?? "unknown"))].map((u) => (
                  <button
                    key={u}
                    type="button"
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      activeUser === u
                        ? "border-cyan-700 bg-cyan-800 text-white shadow-sm"
                        : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50"
                    }`}
                    onClick={() => setActiveUser((prev) => (prev === u ? null : u))}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </section>
            <div className="ui-table-shell overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gradient-to-b from-zinc-100 to-zinc-50/90">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      Operator
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      Form
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      Updated
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {submissions
                    .filter((s) => (activeUser ? (s.username ?? "unknown") === activeUser : true))
                    .map((s) => (
                      <tr key={s.id} className="hover:bg-zinc-50/80">
                        <td className="px-4 py-3 text-sm text-zinc-800">{s.username ?? "unknown"}</td>
                        <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                          {displayFormName(s, templateMap)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                              (s.submissionStatus ?? "final") === "ongoing"
                                ? "bg-amber-100 text-amber-900"
                                : "bg-emerald-100 text-emerald-900"
                            }`}
                          >
                            {(s.submissionStatus ?? "final") === "ongoing" ? "Ongoing" : "Final"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-600">
                          {new Date(s.updatedAt ?? s.submittedAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center justify-end gap-3">
                            <a
                              className="text-sm font-medium text-cyan-800 hover:underline"
                              href={`/dashboard/submission/${s.id}`}
                            >
                              View
                            </a>
                            <a
                              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:underline"
                              href={`/api/submissions/${s.id}/pdf`}
                            >
                              PDF
                            </a>
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
