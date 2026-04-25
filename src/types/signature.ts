/** Stored on submission `top[fieldId]` when the field is digital signature. */
export type DigitalSignatureFieldValue = {
  imageDataUrl: string;
  signedAt: string;
};

export function isDigitalSignatureValue(v: unknown): v is DigitalSignatureFieldValue {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.imageDataUrl === "string" && typeof o.signedAt === "string";
}
