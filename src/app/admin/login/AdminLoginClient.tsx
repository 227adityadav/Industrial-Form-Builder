"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/ui/AuthShell";
import { safeInternalPath } from "@/lib/safe-internal-path";

export function AdminLoginClient() {
  const params = useSearchParams();
  const next = safeInternalPath(params.get("next"), "/admin/builder");

  const [password, setPassword] = React.useState("admin123");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ role: "admin", password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Login failed");
      return;
    }
    window.location.assign(next);
  }

  return (
    <AuthShell
      accent="amber"
      eyebrow="Administrator"
      title="Admin sign in"
      subtitle={
        <>
          Demo password defaults to <span className="font-medium text-zinc-800">admin123</span>.
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <label className="text-sm font-medium text-zinc-800">
          Password
          <input
            className="ui-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            autoFocus
          />
        </label>

        {error ? <div className="ui-alert-error">{error}</div> : null}

        <button disabled={loading} className="ui-btn-primary w-full" type="submit">
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <a className="ui-btn-secondary w-full" href="/admin/folders">
            Folders
          </a>
          <a className="ui-btn-secondary w-full" href="/admin/users">
            Users
          </a>
        </div>

        <Link className="ui-btn-ghost justify-center" href="/">
          ← Back to home
        </Link>
      </form>
    </AuthShell>
  );
}
