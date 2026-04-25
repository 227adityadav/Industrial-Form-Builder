"use client";

import * as React from "react";
import { PageHeader } from "@/components/ui/PageHeader";

type FolderRecord = {
  id: string;
  name: string;
  templateIds: string[];
  allowedUsernames: string[];
};

export default function FormsListPage() {
  const [folders, setFolders] = React.useState<FolderRecord[]>([]);
  const [loading, setLoading] = React.useState(true);

  async function load() {
    setLoading(true);
    const foldersRes = await fetch("/api/folders", { cache: "no-store", credentials: "include" });
    const data = (await foldersRes.json()) as { folders: FolderRecord[] };
    // Folders for role "user" are filtered in GET /api/folders using the same DB session as login.
    setFolders(data.folders ?? []);
    setLoading(false);
  }

  React.useEffect(() => {
    void load();
  }, []);

  return (
    <div className="app-page">
      <PageHeader
        maxWidth="5xl"
        title="Your folders"
        description="Choose a folder, then open a form inside it."
      >
        <button className="ui-btn-secondary" type="button" onClick={load}>
          Refresh
        </button>
        <form
          action={async () => {
            await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
            window.location.assign("/");
          }}
        >
          <button className="ui-btn-secondary" type="submit">
            Log out
          </button>
        </form>
      </PageHeader>

      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="mb-8 flex flex-wrap gap-3">
          <a
            href="/forms/ongoing"
            className="ui-btn-secondary inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium"
          >
            Ongoing
          </a>
          <a
            href="/forms/history"
            className="ui-btn-secondary inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium"
          >
            View history
          </a>
        </div>
        {loading ? (
          <div className="ui-placeholder">Loading…</div>
        ) : folders.length === 0 ? (
          <div className="ui-placeholder">
            No folders assigned yet. Ask an admin to create folders and add you to them.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {folders.map((f) => (
              <a
                key={f.id}
                href={`/forms/folder/${f.id}`}
                className="group ui-card flex flex-col transition-all hover:-translate-y-0.5 hover:border-zinc-300/90 hover:shadow-md"
              >
                <div className="text-base font-semibold text-zinc-900">{f.name}</div>
                <div className="mt-2 text-sm text-zinc-600">
                  {f.templateIds.length} form{f.templateIds.length === 1 ? "" : "s"} in this folder
                </div>
                <span className="mt-4 text-sm font-medium text-emerald-800 group-hover:underline">
                  Open folder →
                </span>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
