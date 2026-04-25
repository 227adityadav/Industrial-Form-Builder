"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";

const AdminFoldersClient = dynamic(() => import("./AdminFoldersClient"), {
  ssr: false,
  loading: () => (
    <div className="app-page">
      <PageHeader
        title="Folders"
        description="Group forms for operators and managers. Assign templates and eligible users per folder."
      >
        <Link className="ui-btn-secondary" href="/admin/builder">
          ← Builder
        </Link>
      </PageHeader>
      <main
        className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[1.2fr_1fr]"
        aria-busy="true"
      >
        <section className="ui-card">
          <h2 className="ui-section-title">Create folder</h2>
          <div className="mt-3 h-44 animate-pulse rounded-xl bg-zinc-100/90" />
        </section>
        <section className="ui-card">
          <h2 className="ui-section-title">Saved folders</h2>
          <div className="mt-4 h-28 animate-pulse rounded-xl bg-zinc-100/90" />
        </section>
      </main>
    </div>
  ),
});

export function AdminFoldersDynamic() {
  return <AdminFoldersClient />;
}
