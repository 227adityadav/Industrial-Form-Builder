"use client";

import * as React from "react";
import type { FolderRecord, MasterFolderRecord } from "@/types/folder";
import { PageHeader } from "@/components/ui/PageHeader";
import { RefillNotificationsBell } from "@/components/notifications/RefillNotificationsBell";

function FolderRow({
  folder,
  masters,
  masterFilter,
  busy,
  onMasterIdsChange,
}: {
  folder: FolderRecord;
  masters: MasterFolderRecord[];
  masterFilter: string;
  busy: boolean;
  onMasterIdsChange: (folder: FolderRecord, masterFolderIds: string[]) => void;
}) {
  const ids = folder.masterFolderIds ?? [];
  const q = masterFilter.trim().toLowerCase();
  const mastersShown = q ? masters.filter((m) => m.name.toLowerCase().includes(q)) : masters;
  return (
    <div className="rounded-xl border border-zinc-200/90 bg-white p-4 ring-1 ring-zinc-950/[0.03]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <a
            href={`/manager/folder/${folder.id}`}
            className="text-base font-semibold text-zinc-900 hover:text-emerald-800 hover:underline"
          >
            {folder.name}
          </a>
          <p className="mt-1 text-xs text-zinc-500">Open to review submissions for this folder.</p>
        </div>
        <div className="min-w-0 flex-1 lg:max-w-xl">
          <p className="text-xs font-medium text-zinc-600">Master groups (pick any combination)</p>
          {masters.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">Create a master folder above to enable grouping.</p>
          ) : mastersShown.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No master groups match your search.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
              {mastersShown.map((m) => (
                <li key={m.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-zinc-300 text-emerald-800 focus:ring-emerald-600/40"
                      checked={ids.includes(m.id)}
                      disabled={busy}
                      onChange={() => {
                        const has = ids.includes(m.id);
                        const next = has ? ids.filter((x) => x !== m.id) : [...ids, m.id];
                        onMasterIdsChange(folder, next);
                      }}
                    />
                    <span>{m.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ManagerHomePage() {
  const [folders, setFolders] = React.useState<FolderRecord[]>([]);
  const [masters, setMasters] = React.useState<MasterFolderRecord[]>([]);
  const [masterName, setMasterName] = React.useState("");
  const [busyFolderId, setBusyFolderId] = React.useState<string | null>(null);
  const [busyMasterId, setBusyMasterId] = React.useState<string | null>(null);
  const [renameId, setRenameId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [status, setStatus] = React.useState<string | null>(null);
  const [siteFolderSearch, setSiteFolderSearch] = React.useState("");
  const [masterGroupSearch, setMasterGroupSearch] = React.useState("");
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

  async function createMaster(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const name = masterName.trim();
    if (!name) return;
    const res = await fetch("/api/master-folders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setStatus(data?.error ?? "Could not create master folder");
      return;
    }
    setMasterName("");
    await load();
  }

  async function deleteMaster(id: string) {
    if (!confirm("Remove this master folder? It will be unchecked from all folders that used it.")) return;
    setBusyMasterId(id);
    setStatus(null);
    const res = await fetch(`/api/master-folders/${id}`, { method: "DELETE" });
    setBusyMasterId(null);
    if (!res.ok) {
      setStatus("Could not delete master folder.");
      return;
    }
    await load();
  }

  async function saveRename(id: string) {
    const name = renameValue.trim();
    if (!name) return;
    setBusyMasterId(id);
    const res = await fetch(`/api/master-folders/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusyMasterId(null);
    setRenameId(null);
    if (!res.ok) {
      setStatus("Could not rename.");
      return;
    }
    await load();
  }

  async function updateFolderMasters(folder: FolderRecord, masterFolderIds: string[]) {
    setBusyFolderId(folder.id);
    setStatus(null);
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: folder.id,
        name: folder.name,
        templateIds: folder.templateIds,
        allowedUsernames: folder.allowedUsernames ?? [],
        masterFolderIds,
      }),
    });
    setBusyFolderId(null);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setStatus(data?.error ?? "Could not update folder");
      await load();
      return;
    }
    await load();
  }

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

  const ungrouped = React.useMemo(
    () => folders.filter((f) => (f.masterFolderIds ?? []).length === 0),
    [folders]
  );

  return (
    <div className="app-page">
      <PageHeader
        maxWidth="5xl"
        title="Manager workspace"
        description="Create master folders, then tick all groups a site folder should appear under (a folder can be in several)."
      >
        <a className="ui-btn-secondary" href="/forms">
          Fill forms
        </a>
        <RefillNotificationsBell />
        <a className="ui-btn-secondary" href="/manager/search">
          Workspace search
        </a>
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
        {status ? <div className="ui-alert text-sm">{status}</div> : null}

        <section className="ui-card">
          <h2 className="ui-section-title">Master folders</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Name a master area (line, plant, customer…). The same site folder can be included in multiple masters.
          </p>
          <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={createMaster}>
            <label className="flex-1 text-sm font-medium text-zinc-800">
              New master name
              <input
                className="ui-input"
                value={masterName}
                onChange={(e) => setMasterName(e.target.value)}
                placeholder="e.g. Plant A · Line 2"
              />
            </label>
            <button className="ui-btn-primary shrink-0 sm:px-6" type="submit">
              Create master folder
            </button>
          </form>

          {masters.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-600">No master folders yet. Create one above.</p>
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
                    className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 ring-1 ring-emerald-900/5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {renameId === m.id ? (
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          <input
                            className="ui-input-compact min-w-[12rem] flex-1"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void saveRename(m.id);
                              if (e.key === "Escape") setRenameId(null);
                            }}
                            autoFocus
                          />
                          <button
                            type="button"
                            className="ui-btn-primary px-3 py-1.5 text-sm"
                            disabled={busyMasterId === m.id}
                            onClick={() => void saveRename(m.id)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="ui-btn-secondary px-3 py-1.5 text-sm"
                            onClick={() => setRenameId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <h3 className="text-lg font-semibold text-zinc-900">{m.name}</h3>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="ui-btn-secondary px-3 py-1.5 text-sm"
                              onClick={() => {
                                setRenameId(m.id);
                                setRenameValue(m.name);
                              }}
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              className="ui-btn-secondary px-3 py-1.5 text-sm text-red-800 hover:border-red-200 hover:bg-red-50"
                              disabled={busyMasterId === m.id}
                              onClick={() => void deleteMaster(m.id)}
                            >
                              {busyMasterId === m.id ? "…" : "Delete master"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    {children.length === 0 ? (
                      <p className="mt-3 text-sm text-zinc-600">
                        No folders tagged for this master yet. Assign them in <strong>All site folders</strong> below.
                      </p>
                    ) : (
                      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        {children.map((f) => (
                          <li key={f.id}>
                            <a className="font-medium text-emerald-900 hover:underline" href={`/manager/folder/${f.id}`}>
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
            Folders from Admin → Folders. Check every master this folder should appear under; leave all unchecked if
            you only want it listed here.
          </p>
          {folders.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-600">No folders yet. Ask an admin to create folders.</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <label className="min-w-[12rem] flex-1 text-sm font-medium text-zinc-800">
                  Search folders
                  <input
                    className="ui-input mt-1"
                    value={siteFolderSearch}
                    onChange={(e) => setSiteFolderSearch(e.target.value)}
                    placeholder="Filter by folder name…"
                    aria-label="Search site folders"
                  />
                </label>
                {masters.length > 0 ? (
                  <label className="min-w-[12rem] flex-1 text-sm font-medium text-zinc-800">
                    Search master groups
                    <input
                      className="ui-input mt-1"
                      value={masterGroupSearch}
                      onChange={(e) => setMasterGroupSearch(e.target.value)}
                      placeholder="Filter master checkboxes…"
                      aria-label="Search master groups when assigning to folders"
                    />
                  </label>
                ) : null}
              </div>
              {filteredSiteFolders.length === 0 ? (
                <p className="text-sm text-zinc-600">No folders match your search.</p>
              ) : (
                <div className="space-y-3">
                  {filteredSiteFolders.map((f) => (
                    <FolderRow
                      key={f.id}
                      folder={f}
                      masters={masters}
                      masterFilter={masterGroupSearch}
                      busy={busyFolderId === f.id}
                      onMasterIdsChange={updateFolderMasters}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {ungrouped.length > 0 ? (
          <p className="text-center text-sm text-zinc-500">
            {ungrouped.length} folder{ungrouped.length === 1 ? "" : "s"} with no master tags (only in “All site
            folders” above).
          </p>
        ) : null}
      </main>
    </div>
  );
}
