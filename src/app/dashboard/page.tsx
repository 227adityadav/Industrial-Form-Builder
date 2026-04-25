"use client";

import * as React from "react";
import type { FolderRecord, MasterFolderRecord } from "@/types/folder";
import { PageHeader } from "@/components/ui/PageHeader";
import { RefillNotificationsBell } from "@/components/notifications/RefillNotificationsBell";

export default function DashboardHomePage() {
  const [folders, setFolders] = React.useState<FolderRecord[]>([]);
  const [masters, setMasters] = React.useState<MasterFolderRecord[]>([]);
  const [siteFolderSearch, setSiteFolderSearch] = React.useState("");
  const [masterListSearch, setMasterListSearch] = React.useState("");

  const filteredSiteFolders = React.useMemo(() => {
    const q = siteFolderSearch.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((f) => f.name.toLowerCase().includes(q));
  }, [folders, siteFolderSearch]);

  const filteredMastersForList = React.useMemo(() => {
    const q = masterListSearch.trim().toLowerCase();
    if (!q) return masters;
    return masters.filter((m) => m.name.toLowerCase().includes(q));
  }, [masters, masterListSearch]);

  const masterNameById = React.useMemo(
    () => new Map(masters.map((m) => [m.id, m.name] as const)),
    [masters]
  );

  const foldersByMaster = React.useMemo(() => {
    const map = new Map<string, FolderRecord[]>();
    for (const m of masters) map.set(m.id, []);
    for (const f of folders) {
      for (const mid of f.masterFolderIds ?? []) {
        const list = map.get(mid);
        if (list) list.push(f);
      }
    }
    return map;
  }, [folders, masters]);

  async function load() {
    const [fRes, mRes] = await Promise.all([
      fetch("/api/folders", { cache: "no-store" }),
      fetch("/api/master-folders", { cache: "no-store" }),
    ]);
    const fData = (await fRes.json()) as { folders: FolderRecord[] };
    const mData = (await mRes.json()) as { masters: MasterFolderRecord[] };
    setFolders(fData.folders ?? []);
    setMasters(mData.masters ?? []);
  }

  React.useEffect(() => {
    void load();
  }, []);

  return (
    <div className="app-page">
      <PageHeader
        maxWidth="5xl"
        title="Overview dashboard"
        description="Master folders and site folders from the manager workspace. This view is read-only; edits are done in Manager."
      >
        <RefillNotificationsBell />
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

      <main className="mx-auto w-full max-w-5xl space-y-8 px-6 py-8">
        <section className="ui-card">
          <h2 className="ui-section-title">Master folders</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Groups created in the manager workspace. Open a site folder below to see submissions and PDFs.
          </p>

          {masters.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-600">No master folders yet.</p>
          ) : (
            <>
              <label className="mt-6 block text-sm font-medium text-zinc-800">
                Search master folders
                <input
                  className="ui-input mt-1 max-w-md"
                  value={masterListSearch}
                  onChange={(e) => setMasterListSearch(e.target.value)}
                  placeholder="Filter by name…"
                  aria-label="Search master folders list"
                />
              </label>
              {filteredMastersForList.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-600">No master folders match your search.</p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {filteredMastersForList.map((m) => {
                    const children = foldersByMaster.get(m.id) ?? [];
                    return (
                      <li
                        key={m.id}
                        className="rounded-xl border border-cyan-200/80 bg-cyan-50/40 p-4 ring-1 ring-cyan-900/5"
                      >
                        <h3 className="text-lg font-semibold text-zinc-900">{m.name}</h3>
                        {children.length === 0 ? (
                          <p className="mt-3 text-sm text-zinc-600">No site folders tagged under this master.</p>
                        ) : (
                          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                            {children.map((f) => (
                              <li key={f.id}>
                                <a
                                  className="font-medium text-cyan-900 hover:underline"
                                  href={`/dashboard/folder/${f.id}`}
                                >
                                  {f.name}
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </section>

        <section className="ui-card">
          <h2 className="ui-section-title">All site folders</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Every folder from Admin → Folders. Master tags show how each folder is grouped in the manager workspace.
          </p>
          {folders.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-600">No folders yet.</p>
          ) : (
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-medium text-zinc-800">
                Search folders
                <input
                  className="ui-input mt-1 max-w-md"
                  value={siteFolderSearch}
                  onChange={(e) => setSiteFolderSearch(e.target.value)}
                  placeholder="Filter by folder name…"
                  aria-label="Search site folders"
                />
              </label>
              {filteredSiteFolders.length === 0 ? (
                <p className="text-sm text-zinc-600">No folders match your search.</p>
              ) : (
                <div className="space-y-3">
                  {filteredSiteFolders.map((f) => {
                    const mids = f.masterFolderIds ?? [];
                    return (
                      <div
                        key={f.id}
                        className="rounded-xl border border-zinc-200/90 bg-white p-4 ring-1 ring-zinc-950/[0.03]"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <a
                              href={`/dashboard/folder/${f.id}`}
                              className="text-base font-semibold text-zinc-900 hover:text-cyan-800 hover:underline"
                            >
                              {f.name}
                            </a>
                            <p className="mt-1 text-xs text-zinc-500">Open to review submissions and download PDFs.</p>
                          </div>
                          <div className="min-w-0 sm:max-w-md">
                            <p className="text-xs font-medium text-zinc-600">Master groups</p>
                            {mids.length === 0 ? (
                              <p className="mt-1 text-sm text-zinc-500">None (not listed under a master).</p>
                            ) : (
                              <ul className="mt-2 flex flex-wrap gap-2">
                                {mids.map((id) => (
                                  <li
                                    key={id}
                                    className="rounded-full border border-cyan-200/90 bg-cyan-50/80 px-2.5 py-0.5 text-xs font-medium text-cyan-950"
                                  >
                                    {masterNameById.get(id) ?? id}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
