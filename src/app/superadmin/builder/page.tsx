"use client";

import { FormBuilderClient } from "@/components/FormBuilderClient";

const superadminBuilderConfig = {
  templatesApi: "/api/super-templates",
  pageTitle: "Super template builder",
  pageDescription: "Design super templates separately from admin templates. They are not linked to folders or operator forms.",
  sidebarTitle: "Super templates",
  newTemplateLabel: "New super template",
  saveTemplateLabel: "Save super template",
  emptyListMessage: "No super templates saved yet.",
  defaultTemplateName: "New Super Template",
} as const;

export default function SuperAdminBuilderPage() {
  return <FormBuilderClient config={superadminBuilderConfig} />;
}
