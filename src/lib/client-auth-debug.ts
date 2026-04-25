/** Set `NEXT_PUBLIC_AUTH_DEBUG=1` in `.env.local` to log login flows in the browser console. */

export function isAuthClientDebug(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_DEBUG === "1";
}

export function logAuthClient(step: string, data?: Record<string, unknown>): void {
  if (!isAuthClientDebug()) return;
  console.info(`[auth/client] ${step}`, { ...data, t: new Date().toISOString() });
}
