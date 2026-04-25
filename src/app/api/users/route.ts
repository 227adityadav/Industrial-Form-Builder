import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { sanitizeUser } from "@/lib/user-sanitize";
import { appUsernameExists, createAppUser, listAppUsersForAdmin } from "@/lib/db/users";
import { connectToDatabase } from "@/lib/db/connection";

export const dynamic = "force-dynamic";

/** Used by admin client routes that call the API with cookies (e.g. folders). User list is also loaded on the server for `/admin/users`. */
export async function GET() {
  await connectToDatabase();
  const session = await getAuthSession();
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await listAppUsersForAdmin();
  return NextResponse.json({ users: users.map((u) => sanitizeUser(u)) });
}

export async function POST(req: Request) {
  await connectToDatabase();
  const session = await getAuthSession();
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { username?: string; password?: string; role?: "user" | "manager" }
    | null;

  const username = body?.username?.trim();
  const password = body?.password?.trim();
  const role = body?.role;

  if (!username || !password || (role !== "user" && role !== "manager")) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (await appUsernameExists(username)) {
    return NextResponse.json({ error: "Username already exists" }, { status: 400 });
  }

  const record = await createAppUser({ username, password, role });
  return NextResponse.json({ ok: true, user: sanitizeUser(record) });
}
