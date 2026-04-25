/**
 * Normalizes a `next` search param for post-login redirects.
 * Only same-origin absolute paths are allowed (blocks `//evil` and `https:` URLs).
 */
export function safeInternalPath(value: string | null | undefined, fallback: string): string {
  const s = (value ?? "").trim();
  if (!s.startsWith("/") || s.startsWith("//")) return fallback;
  if (s.includes("://") || s.includes("\\")) return fallback;
  return s;
}
