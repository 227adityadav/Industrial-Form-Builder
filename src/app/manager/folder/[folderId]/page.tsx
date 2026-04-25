"use client";

import * as React from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FolderRecord } from "@/types/folder";
import { PageHeader } from "@/components/ui/PageHeader";
import { RefillNotificationsBell } from "@/components/notifications/RefillNotificationsBell";

function isoToDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Submission = {
  id: string;
  templateId: string;
  folderId?: string;
  username?: string;
  submittedAt: string;
  updatedAt?: string;
  submissionStatus?: "ongoing" | "final";
};

type TemplateRecord = { id: string; name: string };

export default function ManagerFolderPage() {
  const { folderId } = useParams<{ folderId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromQ = searchParams.get("from");
  const toQ = searchParams.get("to");

  const [folder, setFolder] = React.useState<FolderRecord | null>(null);
  const [submissions, setSubmissions] = React.useState<Submission[]>([]);
  const [templateMap, setTemplateMap] = React.useState<Record<string, string>>({});
  const [activeUser, setActiveUser] = React.useState<string | null>(null);
  const [fromLocal, setFromLocal] = React.useState("");
  const [toLocal, setToLocal] = React.useState("");

  React.useEffect(() => {
    setFromLocal(isoToDatetimeLocalValue(fromQ));
    setToLocal(isoToDatetimeLocalValue(toQ));
  }, [fromQ, toQ]);

  React.useEffect(() => {
    async function load() {
      const subParams = new URLSearchParams();
      subParams.set("folderId", folderId);
      if (fromQ) subParams.set("from", fromQ);
      if (toQ) subParams.set("to", toQ);
      const [foldersRes, submissionsRes, templatesRes] = await Promise.all([
        fetch("/api/folders", { cache: "no-store" }),
        fetch(`/api/submissions?${subParams.toString()}`, { cache: "no-store" }),
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
  }, [folderId, fromQ, toQ]);

  function applyTimestampFilter() {
    const next = new URLSearchParams();
    if (fromLocal.trim()) {
      const t = new Date(fromLocal).getTime();
      if (!Number.isNaN(t)) next.set("from", new Date(fromLocal).toISOString());
    }
    if (toLocal.trim()) {
      const t = new Date(toLocal).getTime();
      if (!Number.isNaN(t)) next.set("to", new Date(toLocal).toISOString());
    }
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  }

  function clearTimestampFilter() {
    setFromLocal("");
    setToLocal("");
    router.replace(pathname);
  }

  return (
    <div className="app-page">
      <PageHeader
        title={folder?.name ?? "Folder"}
        description="Submissions recorded for this folder."
      >
        <RefillNotificationsBell />
        <a className="ui-btn-secondary" href="/manager">
          ← All folders
        </a>
      </PageHeader>
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <section className="ui-card mb-6">
          <h2 className="ui-section-title">Timestamp filter</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Keep submissions whose last update time falls between the chosen times (inclusive). Uses each row’s
            updated time, or submitted time if never updated.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="min-w-[12rem] flex-1 text-sm font-medium text-zinc-800">
              From
              <input
                type="datetime-local"
                className="ui-input mt-1"
                value={fromLocal}
                onChange={(e) => setFromLocal(e.target.value)}
                aria-label="Filter from time"
              />
            </label>
            <label className="min-w-[12rem] flex-1 text-sm font-medium text-zinc-800">
              To
              <input
                type="datetime-local"
                className="ui-input mt-1"
                value={toLocal}
                onChange={(e) => setToLocal(e.target.value)}
                aria-label="Filter to time"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="ui-btn-primary px-4 py-2 text-sm" onClick={() => applyTimestampFilter()}>
                Apply
              </button>
              <button type="button" className="ui-btn-secondary px-4 py-2 text-sm" onClick={() => clearTimestampFilter()}>
                Clear
              </button>
            </div>
          </div>
        </section>

        {submissions.length === 0 ? (
          <div className="ui-placeholder">
            {fromQ || toQ
              ? "No submissions in this folder match the selected time range."
              : "No submitted forms in this folder yet."}
          </div>
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
                        ? "border-emerald-700 bg-emerald-800 text-white shadow-sm"
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
                          {templateMap[s.templateId] ?? s.templateId}
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
                              className="text-sm font-medium text-emerald-800 hover:underline"
                              href={`/manager/submission/${s.id}`}
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
