"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";

type FolderRecord = {
  id: string;
  name: string;
  templateIds: string[];
  allowedUsernames: string[];
};
type TemplateRecord = { id: string; name: string };

export default function UserFolderPage() {
  const { folderId } = useParams<{ folderId: string }>();
  const [folder, setFolder] = React.useState<FolderRecord | null>(null);
  const [templates, setTemplates] = React.useState<TemplateRecord[]>([]);

  React.useEffect(() => {
    async function load() {
      const [folderRes, templateRes] = await Promise.all([
        fetch("/api/folders", { cache: "no-store", credentials: "include" }),
        fetch("/api/templates", { cache: "no-store", credentials: "include" }),
      ]);
      const folderData = (await folderRes.json()) as { folders: FolderRecord[] };
      const templateData = (await templateRes.json()) as { templates: TemplateRecord[] };
      const found = (folderData.folders ?? []).find((f) => f.id === folderId) ?? null;
      setFolder(found);
      if (!found) return;
      setTemplates((templateData.templates ?? []).filter((t) => found.templateIds.includes(t.id)));
    }
    void load();
  }, [folderId]);

  if (!folder) {
    return (
      <div className="app-page px-6 py-12">
        <div className="ui-placeholder mx-auto max-w-lg">Folder not found.</div>
      </div>
    );
  }

  return (
    <div className="app-page">
      <PageHeader
        maxWidth="5xl"
        title={folder.name}
        description="Pick a form to open and fill."
      >
        <Link className="ui-btn-secondary" href="/forms">
          ← All folders
        </Link>
      </PageHeader>
      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        {templates.length === 0 ? (
          <div className="ui-placeholder">No forms are assigned to this folder yet.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {templates.map((t) => (
              <a
                key={t.id}
                href={`/forms/${t.id}?folderId=${folder.id}`}
                className="group ui-card transition-all hover:-translate-y-0.5 hover:border-zinc-300/90 hover:shadow-md"
              >
                <div className="text-base font-semibold text-zinc-900">{t.name}</div>
                <span className="mt-3 inline-block text-sm font-medium text-emerald-800 group-hover:underline">
                  Open form →
                </span>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
