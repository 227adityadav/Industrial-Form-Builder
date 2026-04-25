import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { runChatQuery } from "@/lib/chatai/query-service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (session.role !== "manager") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { message?: string } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const result = await runChatQuery(message);
  return NextResponse.json(result);
}
