"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/ui/AuthShell";
import { logAuthClient } from "@/lib/client-auth-debug";
import { safeInternalPath } from "@/lib/safe-internal-path";

export function DashboardLoginClient() {
  const params = useSearchParams();
  const next = safeInternalPath(params.get("next"), "/dashboard");

  const [username, setUsername] = React.useState("dashboard");
  const [password, setPassword] = React.useState("dashboard123");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    logAuthClient("login_submit", { role: "dashboard", next });
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ role: "dashboard", username, password }),
    });
    setLoading(false);
    logAuthClient("login_response", { status: res.status, ok: res.ok });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      logAuthClient("login_error_body", { error: data?.error ?? null });
      setError(data?.error ?? "Login failed");
      return;
    }
    logAuthClient("login_redirect", { next });
    window.location.assign(next);
  }

  return (
    <AuthShell
      accent="cyan"
      eyebrow="Dashboard"
      title="Sign in"
      subtitle={
        <>
          View master folders, site folders, and submissions—read-only. Demo password:{" "}
          <span className="font-medium text-zinc-800">dashboard123</span>.
        </>
      }
    >
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
        <Link
          className="flex w-full items-center justify-center rounded-lg border border-indigo-200/80 bg-indigo-50/80 py-2.5 text-sm font-medium text-indigo-900 transition-colors hover:border-indigo-300 hover:bg-indigo-100/90"
          href="/chatai"
        >
          chatAI
        </Link>
        <Link className="ui-btn-ghost justify-center" href="/">
          ← Back to home
        </Link>
      </form>
    </AuthShell>
  );
}
