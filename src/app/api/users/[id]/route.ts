import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { hashSignaturePassword } from "@/lib/signature-password";
import { sanitizeUser } from "@/lib/user-sanitize";
import { connectToDatabase } from "@/lib/db/connection";
import { deleteUserById, findUserById, getAppUserRecordById, patchUserSignatureFields } from "@/lib/db/users";

export const dynamic = "force-dynamic";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase();
  const session = await getAuthSession();
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const target = await findUserById(id);
  if (target?.username === "manager") {
    return NextResponse.json({ error: "Default manager cannot be deleted" }, { status: 400 });
  }
  if (target?.username === "dashboard") {
    return NextResponse.json({ error: "Default dashboard cannot be deleted" }, { status: 400 });
  }
  if (target?.username === "SPC") {
    return NextResponse.json({ error: "Default SPC login cannot be deleted" }, { status: 400 });
  }
  await deleteUserById(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase();
  const session = await getAuthSession();
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as
    | {
        signatureImageDataUrl?: string | null;
        signaturePassword?: string | null;
        clearDigitalSignature?: boolean;
      }
    | null;

  const existing = await findUserById(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (String(existing.role) === "admin") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body?.clearDigitalSignature) {
    await patchUserSignatureFields(id, { clearDigital: true });
    const next = await getAppUserRecordById(id);
    if (!next) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, user: sanitizeUser(next) });
  }

  const sigImg = body?.signatureImageDataUrl?.trim();
  const sigPwd = body?.signaturePassword?.trim();

  if (sigImg || sigPwd) {
    if (!sigImg || !sigPwd) {
      return NextResponse.json(
        { error: "Both signature image and signature password are required to set or update a digital signature." },
        { status: 400 }
      );
    }
    if (!sigImg.startsWith("data:image/")) {
      return NextResponse.json({ error: "Invalid signature image" }, { status: 400 });
    }
    await patchUserSignatureFields(id, {
      clearDigital: false,
      digitalSignaturePng: sigImg,
      digitalSignaturePasswordHash: hashSignaturePassword(sigPwd),
    });
  }

  const next = await getAppUserRecordById(id);
  if (!next) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, user: sanitizeUser(next) });
}
