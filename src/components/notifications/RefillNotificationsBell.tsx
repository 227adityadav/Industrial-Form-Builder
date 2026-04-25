"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import type { RefillNotificationRecord } from "@/types/refill-notification";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function RefillNotificationsBell() {
  const pathname = usePathname();
  const base = pathname.startsWith("/dashboard") ? "/dashboard" : "/manager";
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<RefillNotificationRecord[]>([]);
  const [badgeCount, setBadgeCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/refill-notifications", { cache: "no-store" });
    setLoading(false);
    if (!res.ok) return;
    const data = (await res.json()) as { notifications?: RefillNotificationRecord[]; badgeCount?: number };
    setItems(data.notifications ?? []);
    setBadgeCount(data.badgeCount ?? 0);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const t = window.setInterval(() => void load(), 45_000);
    return () => window.clearInterval(t);
  }, [load]);

  React.useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function markAllRead() {
    const res = await fetch("/api/refill-notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    if (res.ok) void load();
  }

  const now = Date.now();
  const due = items.filter((n) => new Date(n.dueAt).getTime() <= now);
  const upcoming = items.filter((n) => new Date(n.dueAt).getTime() > now);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
        aria-label="Refill due notifications"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {badgeCount > 0 ? (
          <span
            className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white"
            title={`${badgeCount} due`}
          />
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-[100] mt-2 w-[min(100vw-2rem,22rem)] max-h-[min(70vh,26rem)] overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-xl ring-1 ring-zinc-950/5">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2">
            <div className="text-sm font-semibold text-zinc-900">Next fill due</div>
            {items.some((n) => !n.readAt) ? (
              <button type="button" className="text-xs font-medium text-emerald-800 hover:underline" onClick={() => void markAllRead()}>
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-[min(65vh,22rem)] overflow-auto p-2">
            {loading && items.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-zinc-500">Loading…</div>
            ) : items.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-zinc-500">No refill reminders.</div>
            ) : (
              <div className="space-y-4">
                {due.length > 0 ? (
                  <div>
                    <div className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-red-700">Due</div>
                    <ul className="space-y-2">
                      {due.map((n) => (
                        <li
                          key={n.id}
                          className={`rounded-lg border px-3 py-2 text-sm ${
                            n.readAt ? "border-zinc-100 bg-zinc-50/80 text-zinc-600" : "border-red-200/90 bg-red-50/50"
                          }`}
                        >
                          <div className="font-medium text-zinc-900">{n.folderName}</div>
                          <div className="mt-0.5 text-xs text-zinc-600">{n.templateName}</div>
                          <div className="mt-1 text-xs text-zinc-700">
                            Due {formatWhen(n.dueAt)}
                            {n.username ? ` · ${n.username}` : null}
                          </div>
                          <a
                            className="mt-2 inline-block text-xs font-medium text-emerald-800 hover:underline"
                            href={`${base}/folder/${n.folderId}`}
                          >
                            Open folder
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {upcoming.length > 0 ? (
                  <div>
                    <div className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Upcoming</div>
                    <ul className="space-y-2">
                      {upcoming.map((n) => (
                        <li key={n.id} className="rounded-lg border border-zinc-100 bg-zinc-50/40 px-3 py-2 text-sm">
                          <div className="font-medium text-zinc-900">{n.folderName}</div>
                          <div className="mt-0.5 text-xs text-zinc-600">{n.templateName}</div>
                          <div className="mt-1 text-xs text-zinc-700">
                            Due {formatWhen(n.dueAt)}
                            {n.username ? ` · ${n.username}` : null}
                          </div>
                          <a
                            className="mt-2 inline-block text-xs font-medium text-cyan-800 hover:underline"
                            href={`${base}/folder/${n.folderId}`}
                          >
                            Open folder
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
