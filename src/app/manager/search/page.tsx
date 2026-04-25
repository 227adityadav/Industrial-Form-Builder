"use client";

import Link from "next/link";
import { ChataiGlobalSearch } from "@/components/chatai/ChataiGlobalSearch";

export default function ManagerWorkspaceSearchPage() {
  return (
    <div className="app-page">
      <div className="mx-auto min-h-dvh w-full max-w-2xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-zinc-900">Workspace search</h1>
          <div className="flex flex-wrap gap-2">
            <Link href="/manager" className="ui-btn-secondary text-sm">
              ← Manager workspace
            </Link>
            <button
              type="button"
              className="ui-btn-secondary text-sm"
              onClick={() => {
                void fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(() => {
                  window.location.assign("/manager/login");
                });
              }}
            >
              Log out
            </button>
          </div>
        </div>
        <p className="mb-6 text-sm text-zinc-600">
          Search across users, master groups, site folders, form templates, submissions (including filled field text), refills, and
          app pages. Choosing a result opens the matching page, folder, or submission.
        </p>
        <div className="rounded-xl border border-zinc-200/90 bg-white p-4 ring-1 ring-zinc-950/[0.03]">
          <ChataiGlobalSearch variant="page" />
        </div>
      </div>
    </div>
  );
}
