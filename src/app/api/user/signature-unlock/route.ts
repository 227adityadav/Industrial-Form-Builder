import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { verifySignaturePassword } from "@/lib/signature-password";
import { connectToDatabase } from "@/lib/db/connection";
import { getUserByUsernameForSignature } from "@/lib/db/users";

export const dynamic = "force-dynamic";

/**
 * Operator verifies their enrolled signature password; returns the stored PNG and a fresh timestamp for the submission.
 */
export async function POST(req: Request) {
  await connectToDatabase();
  const session = await getAuthSession();
  if (session.role !== "user" || !session.username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password ?? "";
  if (!password.trim()) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  const user = await getUserByUsernameForSignature(session.username);
  if (!user?.digitalSignaturePng || !user.digitalSignaturePasswordHash) {
    return NextResponse.json(
      { error: "No digital signature is set up for your account. Ask an administrator to enroll one in Users." },
      { status: 400 }
    );
  }

  if (!verifySignaturePassword(password, String(user.digitalSignaturePasswordHash))) {
    return NextResponse.json({ error: "Invalid signature password" }, { status: 401 });
  }

  const signedAt = new Date().toISOString();
  return NextResponse.json({
    ok: true,
    imageDataUrl: user.digitalSignaturePng,
    signedAt,
  });
}
