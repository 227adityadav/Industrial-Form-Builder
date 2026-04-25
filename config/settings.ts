/**
 * Session and app settings from the environment.
 * Database URL is resolved in `src/lib/db/connection.ts` (env `MONGODB_URI`, or in-memory in development).
 */
export function getSessionMaxAgeMs(): number {
  const days = Math.max(1, parseInt(process.env.SESSION_MAX_AGE_DAYS ?? "7", 10) || 7);
  return days * 24 * 60 * 60 * 1000;
}
