import { randomBytes } from "node:crypto";
import { getSessionMaxAgeMs } from "@config/settings";
import { connectToDatabase } from "@/lib/db/connection";
import { SessionModel } from "@/lib/db/models";
import type { Role } from "@/lib/auth";

export async function createSessionRecord(input: { userId: string; username: string; role: Role }): Promise<string> {
  await connectToDatabase();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + getSessionMaxAgeMs());
  await SessionModel.create({
    token,
    userId: input.userId,
    username: input.username,
    role: input.role,
    expiresAt,
    createdAt: new Date(),
  });
  return token;
}

export async function findValidSessionByToken(token: string | undefined) {
  if (!token) return null;
  await connectToDatabase();
  const s = await SessionModel.findOne({ token }).lean();
  if (!s) return null;
  if (new Date(s.expiresAt).getTime() <= Date.now()) {
    await SessionModel.deleteOne({ token });
    return null;
  }
  return s;
}

export async function deleteSessionByToken(token: string | undefined) {
  if (!token) return;
  await connectToDatabase();
  await SessionModel.deleteOne({ token });
}
