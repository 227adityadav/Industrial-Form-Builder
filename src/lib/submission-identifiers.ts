import type { SubmissionRecord } from "@/types/submission";

/**
 * Normalize Mongo / JSON shapes (string, ObjectId-like, { $oid }) to a stable string id.
 */
export function normalizeMongoIdish(v: unknown): string | null {
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  if (v == null) return null;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.$oid === "string" && o.$oid.trim().length > 0) return o.$oid.trim();
    const toHex = (o as { toHexString?: () => string }).toHexString;
    if (typeof toHex === "function") {
      const hex = toHex.call(v);
      if (typeof hex === "string" && hex.trim().length > 0) return hex.trim();
    }
    const toStr = (o as { toString?: () => string }).toString;
    if (typeof toStr === "function") {
      const s = toStr.call(v);
      if (typeof s === "string" && s.trim().length > 0 && s !== "[object Object]") return s.trim();
    }
  }
  return null;
}

/** Public submission id for URLs and React keys (prefers `id`, falls back to `_id`). */
export function readStableSubmissionIdFromBody(raw: SubmissionRecord): string | null {
  const fromId = normalizeMongoIdish(raw.id);
  if (fromId) return fromId;
  return normalizeMongoIdish((raw as unknown as { _id?: unknown })._id);
}
