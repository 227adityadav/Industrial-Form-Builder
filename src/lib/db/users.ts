import { connectToDatabase } from "@/lib/db/connection";
import { UserModel } from "@/lib/db/models";
import { comparePassword, hashPassword } from "@/lib/password";
import type { Role } from "@/lib/auth";
import type { UserRecord } from "@/types/user";

function toUserRecord(
  d: {
    _id: string;
    username: string;
    role: string;
    createdAt: string;
    updatedAt: string;
    digitalSignaturePng?: string;
    digitalSignaturePasswordHash?: string;
    digitalSignatureSignerName?: string;
  }
): UserRecord {
  if (d.role === "admin") {
    throw new Error("toUserRecord: admin is not an app user row");
  }
  return {
    id: d._id,
    username: d.username,
    role: d.role as UserRecord["role"],
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    digitalSignaturePng: d.digitalSignaturePng,
    digitalSignaturePasswordHash: d.digitalSignaturePasswordHash,
    digitalSignatureSignerName: d.digitalSignatureSignerName,
  };
}

export async function listAppUsersForAdmin(): Promise<UserRecord[]> {
  await connectToDatabase();
  const rows = await UserModel.find({ role: { $ne: "admin" } })
    .lean()
    .sort({ createdAt: -1 });
  return rows.map((r) => toUserRecord(r as Parameters<typeof toUserRecord>[0]));
}

export async function findUserById(id: string) {
  await connectToDatabase();
  return UserModel.findById(id).lean();
}

export async function getAppUserRecordById(id: string): Promise<UserRecord | null> {
  const u = await findUserById(id);
  if (!u) return null;
  if (String((u as { role: string }).role) === "admin") return null;
  return toUserRecord(u as Parameters<typeof toUserRecord>[0]);
}

export async function findUserByUsernameAndRole(username: string, role: Role) {
  await connectToDatabase();
  return UserModel.findOne({ username, role }).lean();
}

export async function findAdminUser() {
  await connectToDatabase();
  return UserModel.findOne({ role: "admin" }).lean();
}

export async function verifyUserPassword(plain: string, passwordHash: string) {
  return comparePassword(plain, passwordHash);
}

export async function createAppUser(input: { username: string; password: string; role: "user" | "manager" }): Promise<UserRecord> {
  await connectToDatabase();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(input.password);
  const doc = await UserModel.create({
    username: input.username,
    passwordHash,
    role: input.role,
    createdAt: now,
    updatedAt: now,
  });
  const o = doc.toObject();
  return toUserRecord({
    _id: String(o._id),
    username: o.username,
    role: o.role,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    digitalSignaturePng: o.digitalSignaturePng,
    digitalSignaturePasswordHash: o.digitalSignaturePasswordHash,
    digitalSignatureSignerName: o.digitalSignatureSignerName,
  });
}

export async function deleteUserById(id: string) {
  await connectToDatabase();
  await UserModel.deleteOne({ _id: id });
}

export async function patchUserSignatureFields(
  id: string,
  next: {
    clearDigital?: boolean;
    digitalSignaturePng?: string;
    digitalSignaturePasswordHash?: string;
    digitalSignatureSignerName?: string;
  }
) {
  await connectToDatabase();
  const now = new Date().toISOString();
  if (next.clearDigital) {
    await UserModel.updateOne(
      { _id: id },
      {
        $unset: { digitalSignaturePng: 1, digitalSignaturePasswordHash: 1, digitalSignatureSignerName: 1 },
        $set: { updatedAt: now },
      }
    );
    return;
  }
  if (next.digitalSignaturePng && next.digitalSignaturePasswordHash) {
    await UserModel.updateOne(
      { _id: id },
      {
        $set: {
          digitalSignaturePng: next.digitalSignaturePng,
          digitalSignaturePasswordHash: next.digitalSignaturePasswordHash,
          digitalSignatureSignerName: next.digitalSignatureSignerName,
          updatedAt: now,
        },
      }
    );
  }
}

export async function getUserByUsernameForSignature(username: string) {
  await connectToDatabase();
  return UserModel.findOne({ username }).lean();
}

export async function appUsernameExists(username: string): Promise<boolean> {
  await connectToDatabase();
  const c = await UserModel.countDocuments({ username });
  return c > 0;
}
