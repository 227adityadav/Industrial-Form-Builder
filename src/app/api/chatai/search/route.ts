import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { runGlobalSearch } from "@/lib/chatai/global-search";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getAuthSession();
  const r = session.role;
  if (r !== "manager" && r !== "dashboard") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { q?: string } | null;
  const q = typeof body?.q === "string" ? body.q : "";
  const { hits, error } = await runGlobalSearch(q);
  return NextResponse.json({ hits, error: error ?? null });
}
