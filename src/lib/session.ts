import { cookies } from "next/headers";
import { isRole, SESSION_COOKIE, type Role } from "@/lib/auth";
import { findValidSessionByToken } from "@/lib/db/sessions";

export async function getAuthSession(): Promise<{
  role: Role | null;
  username: string | null;
}> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const s = await findValidSessionByToken(token);
  if (!s || !isRole(s.role)) return { role: null, username: null };
  return { role: s.role, username: s.username };
}
