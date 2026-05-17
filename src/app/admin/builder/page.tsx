"use client";

import { FormBuilderClient } from "@/components/FormBuilderClient";

const adminBuilderConfig = {
  templatesApi: "/api/templates",
  pageTitle: "Form builder",
  pageDescription: "Add info fields and grids. Reorder with Up/Down on each block.",
  sidebarTitle: "Saved templates",
  newTemplateLabel: "New template",
  saveTemplateLabel: "Save template",
  emptyListMessage: "No templates saved yet.",
  defaultTemplateName: "New Template",
  headerLinks: [
    { href: "/admin/users", label: "Users" },
    { href: "/admin/folders", label: "Folders" },
  ],
} as const;

export default function AdminBuilderPage() {
  return <FormBuilderClient config={adminBuilderConfig} />;
}
