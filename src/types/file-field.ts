/** Stored on submission `top[fieldId]` when the field is photo / document upload. */
export type UploadedFileFieldValue = {
  dataUrl: string;
  fileName: string;
  mimeType: string;
  uploadedAt: string;
};

export function isUploadedFileFieldValue(v: unknown): v is UploadedFileFieldValue {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.dataUrl === "string" &&
    typeof o.fileName === "string" &&
    typeof o.mimeType === "string" &&
    typeof o.uploadedAt === "string"
  );
}
