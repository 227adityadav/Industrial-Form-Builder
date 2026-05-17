import { getAuthSession } from "@/lib/session";
import type { Role } from "@/lib/auth";

export async function requireRole(role: Role): Promise<{ ok: true } | { ok: false; status: 401 | 403 }> {
  const session = await getAuthSession();
  if (!session.role) return { ok: false, status: 401 };
  if (session.role !== role) return { ok: false, status: 403 };
  return { ok: true };
}
