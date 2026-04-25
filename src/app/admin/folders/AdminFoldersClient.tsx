"use client";

import * as React from "react";
import type { FolderRecord } from "@/types/folder";
import { PageHeader } from "@/components/ui/PageHeader";

type TemplateItem = { id: string; name: string };
type UserItem = { id: string; username: string; role: "user" | "manager" };

export default function AdminFoldersClient() {
  const [templates, setTemplates] = React.useState<TemplateItem[]>([]);
  const [folders, setFolders] = React.useState<FolderRecord[]>([]);
  const [users, setUsers] = React.useState<UserItem[]>([]);
  const [folderName, setFolderName] = React.useState("");
  const [selectedTemplates, setSelectedTemplates] = React.useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = React.useState<string[]>([]);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [assignFormsSearch, setAssignFormsSearch] = React.useState("");
  const [dueMode, setDueMode] = React.useState<"none" | "hours" | "daytime">("none");
  const [dueHours, setDueHours] = React.useState("");
  const [dueDays, setDueDays] = React.useState("");
  const [dueTime, setDueTime] = React.useState("09:00");

  const filteredTemplates = React.useMemo(() => {
    const q = assignFormsSearch.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templates, assignFormsSearch]);

  async function load() {
    const [templateRes, folderRes, usersRes] = await Promise.all([
      fetch("/api/templates", { cache: "no-store", credentials: "include" }),
      fetch("/api/folders", { cache: "no-store", credentials: "include" }),
      fetch("/api/users", { cache: "no-store", credentials: "include" }),
    ]);
    const templateData = (await templateRes.json()) as { templates: TemplateItem[] };
    const folderData = (await folderRes.json()) as { folders: FolderRecord[] };
    const userData = (await usersRes.json()) as { users: UserItem[] };
    setTemplates(templateData.templates ?? []);
    setFolders(folderData.folders ?? []);
    setUsers((userData.users ?? []).filter((u) => u.role === "user"));
  }

  React.useEffect(() => {
    void load();
  }, []);

  async function saveFolder() {
    setStatus(null);

    let nextFillDueHours: number | null = null;
    let nextFillDueDays: number | null = null;
    let nextFillDueTime: string | null = null;

    if (dueMode === "hours") {
      const n = Number(dueHours);
      if (!Number.isFinite(n) || n <= 0) {
        setStatus('Enter a positive number of hours for the next-fill deadline, or choose "No deadline".');
        return;
      }
      nextFillDueHours = n;
    } else if (dueMode === "daytime") {
      const d = Number(dueDays);
      const t = dueTime.trim();
      if (!Number.isFinite(d) || d < 0) {
        setStatus("Enter a valid number of days (0 or more) for the next-fill deadline.");
        return;
      }
      if (!/^\d{1,2}:\d{2}$/.test(t)) {
        setStatus("Pick a due time (hours:minutes) for the next-fill deadline.");
        return;
      }
      nextFillDueDays = Math.floor(d);
      nextFillDueTime = t;
    }

    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        id: editingId ?? undefined,
        name: folderName,
        templateIds: selectedTemplates,
        allowedUsernames: selectedUsers,
        nextFillDueHours,
        nextFillDueDays,
        nextFillDueTime,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setStatus(data?.error ?? "Failed to save folder");
      return;
    }
    setStatus("Folder saved.");
    setFolderName("");
    setSelectedTemplates([]);
    setSelectedUsers([]);
    setEditingId(null);
    setDueMode("none");
    setDueHours("");
    setDueDays("");
    setDueTime("09:00");
    await load();
  }

  return (
    <div className="app-page">
      <PageHeader
        title="Folders"
        description="Group forms for operators and managers. Assign templates and eligible users per folder."
      >
        <a className="ui-btn-secondary" href="/admin/builder">
          ← Builder
        </a>
      </PageHeader>

      <main className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[1.2fr_1fr]">
        <section className="ui-card">
          <h2 className="ui-section-title">
            {editingId ? "Edit folder" : "Create folder"}
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800"><span>Folder name</span><input
                className="ui-input"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="e.g. Section A / Production Line 1"
              /></label>

            <div>
              <div className="text-sm font-medium">Assign Forms to this Folder</div>
              {templates.length > 0 ? (
                <label className="mt-2 flex flex-col gap-1 text-sm font-medium text-zinc-700"><span>Search forms</span><input
                    className="ui-input mt-1"
                    value={assignFormsSearch}
                    onChange={(e) => setAssignFormsSearch(e.target.value)}
                    placeholder="Filter by form name…"
                    aria-label="Search forms to assign"
                  /></label>
              ) : null}
              <div className="mt-2 max-h-72 space-y-2 overflow-auto rounded-xl border border-zinc-200/90 bg-zinc-50/40 p-3">
                {templates.length === 0 ? (
                  <div className="text-sm text-zinc-600">No templates yet. Create forms first.</div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="text-sm text-zinc-600">No forms match your search.</div>
                ) : (
                  filteredTemplates.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm"><input
                        type="checkbox"
                        checked={selectedTemplates.includes(t.id)}
                        onChange={(e) =>
                          setSelectedTemplates((prev) =>
                            e.target.checked ? [...prev, t.id] : prev.filter((x) => x !== t.id)
                          )
                        }
                      /><span>{t.name}</span></label>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-3">
              <div className="text-sm font-medium text-zinc-900">Next fill deadline (after each final submission)</div>
              <p className="mt-1 text-xs text-zinc-600">
                When set, manager and dashboard see a reminder when the next fill is due. Leave off for no reminders.
              </p>
              <div className="mt-3 space-y-2 text-sm">
                <label className="flex cursor-pointer items-center gap-2"><input
                    type="radio"
                    name="dueMode"
                    value="none"
                    checked={dueMode === "none"}
                    onChange={() => setDueMode("none")}
                  /><span>No deadline</span></label>
                <label className="flex cursor-pointer items-center gap-2"><input
                    type="radio"
                    name="dueMode"
                    value="hours"
                    checked={dueMode === "hours"}
                    onChange={() => setDueMode("hours")}
                  /><span>Due after (hours)</span></label>
                {dueMode === "hours" ? (
                  <label className="ml-6 flex flex-col gap-1 text-sm font-medium text-zinc-800"><span>Hours after finalization</span><input
                      className="ui-input mt-1 max-w-[12rem]"
                      type="number"
                      min={0.01}
                      step={0.5}
                      value={dueHours}
                      onChange={(e) => setDueHours(e.target.value)}
                      placeholder="e.g. 24"
                    /></label>
                ) : null}
                <label className="flex cursor-pointer items-center gap-2"><input
                    type="radio"
                    name="dueMode"
                    value="daytime"
                    checked={dueMode === "daytime"}
                    onChange={() => setDueMode("daytime")}
                  /><span>Due after (days) at time</span></label>
                {dueMode === "daytime" ? (
                  <div className="ml-6 flex flex-wrap items-end gap-3">
                    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800"><span>Days after finalization</span><input
                        className="ui-input mt-1 w-28"
                        type="number"
                        min={0}
                        step={1}
                        value={dueDays}
                        onChange={(e) => setDueDays(e.target.value)}
                        placeholder="0"
                      /></label>
                    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800"><span>Time</span><input
                        className="ui-input mt-1 w-36"
                        type="time"
                        value={dueTime}
                        onChange={(e) => setDueTime(e.target.value)}
                      /></label>
                  </div>
                ) : null}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium">
                Assign Users to this Folder
                <span className="ml-1 text-xs text-zinc-600">(Manager always has access)</span>
              </div>
              <div className="mt-2 max-h-56 space-y-2 overflow-auto rounded-xl border border-zinc-200/90 bg-zinc-50/40 p-3">
                {users.length === 0 ? (
                  <div className="text-sm text-zinc-600">No user logins yet. Create users first.</div>
                ) : (
                  users.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm"><input
                        type="checkbox"
                        checked={selectedUsers.includes(u.username)}
                        onChange={(e) =>
                          setSelectedUsers((prev) =>
                            e.target.checked
                              ? [...prev, u.username]
                              : prev.filter((x) => x !== u.username)
                          )
                        }
                      /><span>{u.username}</span></label>
                  ))
                )}
              </div>
            </div>

            {status ? <div className="text-sm text-zinc-700">{status}</div> : null}

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="ui-btn-primary" onClick={saveFolder}>
                Save folder
              </button>
              <button
                type="button"
                className="ui-btn-secondary"
                onClick={() => {
                  setEditingId(null);
                  setFolderName("");
                  setSelectedTemplates([]);
                  setSelectedUsers([]);
                  setAssignFormsSearch("");
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </section>

        <section className="ui-card">
          <h2 className="ui-section-title">Saved folders</h2>
          <div className="mt-4 space-y-3">
            {folders.length === 0 ? (
              <div className="text-sm text-zinc-600">No folders yet.</div>
            ) : (
              folders.map((f) => (
                <div key={f.id} className="rounded-xl border border-zinc-200/90 bg-zinc-50/30 p-4 ring-1 ring-zinc-950/[0.03]">
                  <div className="text-sm font-semibold">{f.name}</div>
                  <div className="mt-1 text-xs text-zinc-600">
                    {f.templateIds.length} form(s) · {f.allowedUsernames?.length ?? 0} user(s)
                    {f.nextFillDueHours != null && f.nextFillDueHours > 0 ? (
                      <span className="ml-1">· Next fill due after {f.nextFillDueHours}h</span>
                    ) : f.nextFillDueDays != null && f.nextFillDueTime ? (
                      <span className="ml-1">
                        · Next fill due after {f.nextFillDueDays}d at {f.nextFillDueTime}
                      </span>
                    ) : (
                      <span className="ml-1">· No refill deadline</span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="ui-btn-secondary px-3 py-1.5 text-sm"
                      onClick={() => {
                        setEditingId(f.id);
                        setFolderName(f.name);
                        setSelectedTemplates(f.templateIds);
                        setSelectedUsers(f.allowedUsernames ?? []);
                        if (f.nextFillDueHours != null && f.nextFillDueHours > 0) {
                          setDueMode("hours");
                          setDueHours(String(f.nextFillDueHours));
                          setDueDays("");
                          setDueTime("09:00");
                        } else if (
                          f.nextFillDueDays != null &&
                          f.nextFillDueDays >= 0 &&
                          f.nextFillDueTime &&
                          /^\d{1,2}:\d{2}$/.test(f.nextFillDueTime)
                        ) {
                          setDueMode("daytime");
                          setDueHours("");
                          setDueDays(String(f.nextFillDueDays));
                          setDueTime(f.nextFillDueTime);
                        } else {
                          setDueMode("none");
                          setDueHours("");
                          setDueDays("");
                          setDueTime("09:00");
                        }
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="ui-btn-secondary px-3 py-1.5 text-sm"
                      onClick={async () => {
                        await fetch(`/api/folders/${f.id}`, { method: "DELETE" });
                        await load();
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
