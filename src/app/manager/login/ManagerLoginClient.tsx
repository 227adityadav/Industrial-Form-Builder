"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/ui/AuthShell";
import { ChataiGlobalSearch, MANAGER_PENDING_FLAG } from "@/components/chatai/ChataiGlobalSearch";
import { logAuthClient } from "@/lib/client-auth-debug";
import { safeInternalPath } from "@/lib/safe-internal-path";

export function ManagerLoginClient() {
  const params = useSearchParams();
  const next = safeInternalPath(params.get("next"), "/manager");

  const [username, setUsername] = React.useState("manager");
  const [password, setPassword] = React.useState("manager123");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    logAuthClient("login_submit", { role: "manager", next });
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ role: "manager", username, password }),
    });
    setLoading(false);
    logAuthClient("login_response", { status: res.status, ok: res.ok });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      logAuthClient("login_error_body", { error: data?.error ?? null });
      setError(data?.error ?? "Login failed");
      return;
    }
    let dest = next;
    try {
      if (sessionStorage.getItem(MANAGER_PENDING_FLAG) === "1") {
        dest = "/manager/search";
      }
    } catch {
      /* ignore */
    }
    const finalDest = safeInternalPath(dest, "/manager");
    logAuthClient("login_redirect", { next: finalDest });
    window.location.assign(finalDest);
  }

  return (
    <AuthShell
      accent="violet"
      eyebrow="Manager"
      title="Sign in"
      subtitle={
        <>
          After sign-in you can create <span className="font-medium text-zinc-800">master folders</span> and tag each
          site folder to one or many of them. Demo password:{" "}
          <span className="font-medium text-zinc-800">manager123</span>.
        </>
      }
    >
      <div className="mb-6 rounded-xl border border-violet-200/80 bg-white/80 p-4">
        <ChataiGlobalSearch variant="login" />
      </div>
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <label className="text-sm font-medium text-zinc-800">
          Username
          <input
            className="ui-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        </label>
        <label className="text-sm font-medium text-zinc-800">
          Password
          <input
            className="ui-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
          />
        </label>
        {error ? <div className="ui-alert-error">{error}</div> : null}
        <button disabled={loading} className="ui-btn-primary w-full" type="submit">
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <Link className="ui-btn-ghost justify-center" href="/">
          ← Back to home
        </Link>
      </form>
    </AuthShell>
  );
}
