import { NextResponse } from "next/server";
import { AUTH_COOKIE, isRole, SESSION_COOKIE, type Role, USERNAME_COOKIE } from "@/lib/auth";
import { useSecureSessionCookies } from "@/lib/cookie-secure";
import { connectToDatabase } from "@/lib/db/connection";
import { createSessionRecord } from "@/lib/db/sessions";
import { findAdminUser, findUserByUsernameAndRole, verifyUserPassword } from "@/lib/db/users";
import { getSessionMaxAgeMs } from "@config/settings";

export const dynamic = "force-dynamic";

function authApiLog(message: string, data: Record<string, unknown>) {
  if (process.env.AUTH_DEBUG !== "1") return;
  console.info(`[api/auth/login] ${message}`, { ...data, ts: new Date().toISOString() });
}

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
  const secureCookies = useSecureSessionCookies(req);
  authApiLog("request", {
    forwardedProto: req.headers.get("x-forwarded-proto") ?? null,
    host: req.headers.get("host") ?? null,
    secureCookies,
  });

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
    authApiLog("database_error", { message: e instanceof Error ? e.message : String(e) });
    return NextResponse.json(
      { error: dbErrorMessage(e) },
      { status: 503 }
    );
  }

  const role = body?.role;
  const rawUsername = body?.username?.trim() ?? "";
  const password = body?.password ?? "";

  if (!isRole(role)) {
    authApiLog("reject", { reason: "invalid_role", role: body?.role });
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  if (role === "admin") {
    const admin = await findAdminUser();
    if (!admin || !admin.passwordHash) {
      authApiLog("reject", { reason: "admin_not_found", role: "admin" });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    const ok = await verifyUserPassword(password, String(admin.passwordHash));
    if (!ok) {
      authApiLog("reject", { reason: "bad_password", role: "admin" });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    const token = await createSessionRecord({
      userId: String(admin._id),
      username: String(admin.username),
      role: "admin",
    });
    return jsonWithSession(req, secureCookies, token, "admin", { ok: true });
  }

  if (!rawUsername) {
    authApiLog("reject", { reason: "missing_username", role });
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }
  const found = await findUserByUsernameAndRole(rawUsername, role);
  if (!found?.passwordHash) {
    authApiLog("reject", { reason: "user_not_found", role });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const passOk = await verifyUserPassword(password, String(found.passwordHash));
  if (!passOk) {
    authApiLog("reject", { reason: "bad_password", role });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createSessionRecord({
    userId: String(found._id),
    username: String(found.username),
    role: role as Role,
  });
  return jsonWithSession(req, secureCookies, token, role as Role, { ok: true });
}

function jsonWithSession(
  req: Request,
  secureCookies: boolean,
  token: string,
  role: Role,
  payload: object
) {
  const res = NextResponse.json(payload);
  const maxAge = Math.floor(getSessionMaxAgeMs() / 1000);
  const cookieOpts = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: secureCookies,
    maxAge,
  };
  res.cookies.set(SESSION_COOKIE, token, cookieOpts);
  /** Mirrors session role for Edge middleware; APIs still use SESSION_COOKIE + DB. */
  res.cookies.set(AUTH_COOKIE, role, cookieOpts);
  res.cookies.set(USERNAME_COOKIE, "", { path: "/", maxAge: 0, secure: secureCookies, sameSite: "lax" });
  authApiLog("session_issued", {
    role,
    secureCookies,
    forwardedProto: req.headers.get("x-forwarded-proto") ?? null,
  });
  return res;
}
