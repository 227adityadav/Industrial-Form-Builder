/** API and route paths for operator vs superoperator form filling. */
export type FillFormContext = {
  templatesApi: (templateId: string) => string;
  submissionsApi: string;
  submissionApi: (submissionId: string) => string;
  formPath: (templateId: string) => string;
  viewPath: (submissionId: string) => string;
  historyPath: (queryString?: string) => string;
  listHref: string;
  listLabel: string;
  skipFolderValidation: boolean;
};

export const OPERATOR_FILL_CONTEXT: FillFormContext = {
  templatesApi: (id) => `/api/templates/${encodeURIComponent(id)}`,
  submissionsApi: "/api/submissions",
  submissionApi: (id) => `/api/submissions/${encodeURIComponent(id)}`,
  formPath: (id) => `/forms/${encodeURIComponent(id)}`,
  viewPath: (id) => `/forms/view/${encodeURIComponent(id)}`,
  historyPath: (qs) => (qs ? `/forms/history?${qs}` : "/forms/history"),
  listHref: "/forms",
  listLabel: "Folders",
  skipFolderValidation: false,
};

export const SUPEROPERATOR_FILL_CONTEXT: FillFormContext = {
  templatesApi: (id) => `/api/super-templates/${encodeURIComponent(id)}`,
  submissionsApi: "/api/super-submissions",
  submissionApi: (id) => `/api/super-submissions/${encodeURIComponent(id)}`,
  formPath: (id) => `/superoperator/forms/${encodeURIComponent(id)}`,
  viewPath: (id) => `/superoperator/view/${encodeURIComponent(id)}`,
  historyPath: (qs) => (qs ? `/superoperator/history?${qs}` : "/superoperator/history"),
  listHref: "/superoperator",
  listLabel: "Templates",
  skipFolderValidation: true,
};
