import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE, SESSION_COOKIE, USERNAME_COOKIE } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/connection";
import { deleteSessionByToken } from "@/lib/db/sessions";

export const dynamic = "force-dynamic";

export async function POST() {
  await connectToDatabase();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  await deleteSessionByToken(token);
  const res = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";
  const clearSession = {
    path: "/" as const,
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
  };
  res.cookies.set(SESSION_COOKIE, "", clearSession);
  res.cookies.set(AUTH_COOKIE, "", clearSession);
  res.cookies.set(USERNAME_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
