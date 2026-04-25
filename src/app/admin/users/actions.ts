"use server";

import { revalidatePath } from "next/cache";
import { getAuthSession } from "@/lib/session";
import { hashSignaturePassword } from "@/lib/signature-password";
import { connectToDatabase } from "@/lib/db/connection";
import { deleteUserById, findUserById } from "@/lib/db/users";
import { appUsernameExists, createAppUser } from "@/lib/db/users";
import { patchUserSignatureFields } from "@/lib/db/users";

async function requireAdmin(): Promise<boolean> {
  const s = await getAuthSession();
  return s.role === "admin";
}

export async function adminCreateLogin(input: {
  username: string;
  password: string;
  role: "user" | "manager";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireAdmin())) {
    return { ok: false, error: "Unauthorized" };
  }
  const username = input.username.trim();
  const password = input.password.trim();
  if (!username || !password) {
    return { ok: false, error: "Username and password are required" };
  }
  await connectToDatabase();
  if (await appUsernameExists(username)) {
    return { ok: false, error: "Username already exists" };
  }
  await createAppUser({ username, password, role: input.role });
  revalidatePath("/admin/users");
  revalidatePath("/admin/folders");
  return { ok: true };
}

export async function adminDeleteUser(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireAdmin())) {
    return { ok: false, error: "Unauthorized" };
  }
  await connectToDatabase();
  const target = await findUserById(userId);
  if (target?.username === "manager") {
    return { ok: false, error: "Default manager cannot be deleted" };
  }
  if (target?.username === "dashboard") {
    return { ok: false, error: "Default dashboard cannot be deleted" };
  }
  if (target?.username === "SPC") {
    return { ok: false, error: "Default SPC login cannot be deleted" };
  }
  await deleteUserById(userId);
  revalidatePath("/admin/users");
  revalidatePath("/admin/folders");
  return { ok: true };
}

/** Separate from login: enroll or replace drawn signature + signature-unlock password for a user. */
export async function adminEnrollDigitalSignature(input: {
  userId: string;
  signatureImageDataUrl: string;
  signaturePassword: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireAdmin())) {
    return { ok: false, error: "Unauthorized" };
  }
  const img = input.signatureImageDataUrl.trim();
  const pwd = input.signaturePassword.trim();
  if (!img || !pwd) {
    return { ok: false, error: "Draw a signature and set the signature password." };
  }
  if (!img.startsWith("data:image/")) {
    return { ok: false, error: "Invalid signature image" };
  }
  await connectToDatabase();
  const row = await findUserById(input.userId);
  if (!row || String(row.role) === "admin") {
    return { ok: false, error: "User not found" };
  }
  await patchUserSignatureFields(input.userId, {
    clearDigital: false,
    digitalSignaturePng: img,
    digitalSignaturePasswordHash: hashSignaturePassword(pwd),
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function adminClearDigitalSignature(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireAdmin())) {
    return { ok: false, error: "Unauthorized" };
  }
  await connectToDatabase();
  const u = await findUserById(userId);
  if (!u) {
    return { ok: false, error: "User not found" };
  }
  await patchUserSignatureFields(userId, { clearDigital: true });
  revalidatePath("/admin/users");
  return { ok: true };
}
