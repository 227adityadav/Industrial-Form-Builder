export type RefillNotificationRecord = {
  id: string;
  folderId: string;
  folderName: string;
  templateId: string;
  templateName: string;
  submissionId: string;
  username?: string;
  /** When the form was finalized (drives the deadline). */
  finalizedAt: string;
  dueAt: string;
  createdAt: string;
  readAt: string | null;
};
