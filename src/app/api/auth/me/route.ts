import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { connectToDatabase } from "@/lib/db/connection";

export const dynamic = "force-dynamic";

export async function GET() {
  await connectToDatabase();
  const session = await getAuthSession();
  if (!session.role) {
    return NextResponse.json({ authenticated: false });
  }
  return NextResponse.json({
    authenticated: true,
    role: session.role,
    username: session.username ?? null,
  });
}

