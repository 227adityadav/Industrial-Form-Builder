import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { connectToDatabase } from "@/lib/db/connection";
import { listRefillNotifications, replaceAllRefillNotifications } from "@/lib/db/content";
import type { RefillNotificationRecord } from "@/types/refill-notification";

export const dynamic = "force-dynamic";

export async function GET() {
  await connectToDatabase();
  const session = await getAuthSession();
  if (session.role !== "manager" && session.role !== "dashboard") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const list = await listRefillNotifications();
  const now = Date.now();
  let badgeCount = 0;
  for (const n of list) {
    if (n.readAt) continue;
    if (new Date(n.dueAt).getTime() <= now) badgeCount += 1;
  }

  return NextResponse.json({ notifications: list, badgeCount });
}

export async function PATCH(req: Request) {
  await connectToDatabase();
  const session = await getAuthSession();
  if (session.role !== "manager" && session.role !== "dashboard") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { markAllRead?: boolean; markReadIds?: string[] }
    | null;

  const markAllRead = body?.markAllRead === true;
  const ids = Array.isArray(body?.markReadIds) ? body!.markReadIds!.filter(Boolean) : [];

  if (!markAllRead && ids.length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const list = await listRefillNotifications();
  const now = new Date().toISOString();
  const next: RefillNotificationRecord[] = list.map((n) => {
    if (n.readAt) return n;
    if (markAllRead || ids.includes(n.id)) {
      return { ...n, readAt: now };
    }
    return n;
  });
  await replaceAllRefillNotifications(next);
  return NextResponse.json({ ok: true });
}
