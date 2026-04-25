"use client";

import Link from "next/link";
import { ChataiGlobalSearch } from "@/components/chatai/ChataiGlobalSearch";

export default function ChataiSearchPage() {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-zinc-900">Workspace search</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/chatai" className="ui-btn-ghost text-sm">
            ← Chat query
          </Link>
          <button
            type="button"
            className="ui-btn-ghost text-sm"
            onClick={() => {
              void fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(() => {
                window.location.assign("/manager/login");
              });
            }}
          >
            Sign out
          </button>
        </div>
      </div>
      <p className="mb-6 text-sm text-zinc-600">
        Search across users, folders, form templates, submissions (including filled field text), refills, and app pages. Choosing a
        result opens the manager workspace or the specific folder / submission, with the same viewing access as a manager.
      </p>
      <div className="rounded-xl border border-zinc-200/90 bg-white p-4 ring-1 ring-zinc-950/[0.03]">
        <ChataiGlobalSearch variant="page" />
      </div>
    </div>
  );
}
