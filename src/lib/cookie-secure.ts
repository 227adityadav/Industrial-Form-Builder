/**
 * `Secure` cookies are not stored or sent over plain HTTP. In production we still
 * often serve over HTTP (IP, LAN, TLS terminated elsewhere). Use HTTPS (or
 * `X-Forwarded-Proto: https` from your reverse proxy) to enable Secure cookies.
 *
 * Override: `COOKIE_SECURE=true` / `COOKIE_SECURE=false`.
 */
export function useSecureSessionCookies(request: Request): boolean {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;

  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim().toLowerCase() ?? "";
    return first === "https";
  }

  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}
