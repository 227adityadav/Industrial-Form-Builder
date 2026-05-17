"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";

type TemplateRecord = { id: string; name: string };

export default function SuperOperatorHomePage() {
  const [templates, setTemplates] = React.useState<TemplateRecord[]>([]);
  const [loading, setLoading] = React.useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/super-templates", { cache: "no-store", credentials: "include" });
    const data = (await res.json()) as { templates?: TemplateRecord[] };
    setTemplates(data.templates ?? []);
    setLoading(false);
  }

  React.useEffect(() => {
    void load();
  }, []);

  return (
    <div className="app-page">
      <PageHeader
        maxWidth="5xl"
        title="Super templates"
        description="Forms created by superadmin. Choose a template to fill."
      >
        <button className="ui-btn-secondary" type="button" onClick={() => void load()}>
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
          <Link
            href="/superoperator/history"
            className="ui-btn-secondary inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium"
          >
            View history
          </Link>
        </div>
        {loading ? (
          <div className="ui-placeholder">Loading…</div>
        ) : templates.length === 0 ? (
          <div className="ui-placeholder">
            No super templates yet. Ask a superadmin to create templates in the super builder.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {templates.map((t) => (
              <Link
                key={t.id}
                href={`/superoperator/forms/${encodeURIComponent(t.id)}`}
                className="group ui-card flex flex-col transition-all hover:-translate-y-0.5 hover:border-zinc-300/90 hover:shadow-md"
              >
                <div className="text-base font-semibold text-zinc-900">{t.name}</div>
                <span className="mt-4 text-sm font-medium text-rose-800 group-hover:underline">
                  Open form →
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
