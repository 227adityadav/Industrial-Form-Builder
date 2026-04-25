import { NextResponse } from "next/server";
import { AUTH_COOKIE, isRole, SESSION_COOKIE, type Role, USERNAME_COOKIE } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/connection";
import { createSessionRecord } from "@/lib/db/sessions";
import { findAdminUser, findUserByUsernameAndRole, verifyUserPassword } from "@/lib/db/users";
import { getSessionMaxAgeMs } from "@config/settings";

export const dynamic = "force-dynamic";

function dbErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = String((err as { message: string }).message);
    if (/connect ECONNREFUSED|127\.0\.0\.1:27017/i.test(m) || /ECONNREFUSED.*27017/.test(m)) {
      return "Cannot connect to MongoDB. Start MongoDB locally or set MONGODB_URI in .env.local to your database.";
    }
    if (/authentication failed|bad auth/i.test(m)) {
      return "MongoDB authentication failed. Check MONGODB_URI user/password.";
    }
    if (m.includes("MONGODB_URI") || m.includes("mongodb")) {
      return m;
    }
    return m;
  }
  return "Server error";
}

export async function POST(req: Request) {
  let body: { role?: Role; username?: string; password?: string } | null;
  try {
    body = (await req.json().catch(() => null)) as
      | { role?: Role; username?: string; password?: string }
      | null;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    await connectToDatabase();
  } catch (e) {
    console.error("[api/auth/login] database:", e);
    return NextResponse.json(
      { error: dbErrorMessage(e) },
      { status: 503 }
    );
  }

  const role = body?.role;
  const rawUsername = body?.username?.trim() ?? "";
  const password = body?.password ?? "";

  if (!isRole(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  if (role === "admin") {
    const admin = await findAdminUser();
    if (!admin || !admin.passwordHash) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    const ok = await verifyUserPassword(password, String(admin.passwordHash));
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    const token = await createSessionRecord({
      userId: String(admin._id),
      username: String(admin.username),
      role: "admin",
    });
    return jsonWithSession(token, "admin", { ok: true });
  }

  if (!rawUsername) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }
  const found = await findUserByUsernameAndRole(rawUsername, role);
  if (!found?.passwordHash) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const passOk = await verifyUserPassword(password, String(found.passwordHash));
  if (!passOk) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createSessionRecord({
    userId: String(found._id),
    username: String(found.username),
    role: role as Role,
  });
  return jsonWithSession(token, role as Role, { ok: true });
}

function jsonWithSession(token: string, role: Role, payload: object) {
  const res = NextResponse.json(payload);
  const maxAge = Math.floor(getSessionMaxAgeMs() / 1000);
  const cookieOpts = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge,
  };
  res.cookies.set(SESSION_COOKIE, token, cookieOpts);
  /** Mirrors session role for Edge middleware; APIs still use SESSION_COOKIE + DB. */
  res.cookies.set(AUTH_COOKIE, role, cookieOpts);
  res.cookies.set(USERNAME_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
