import { getPasswordForRole } from "@/lib/auth";
import type { Role } from "@/lib/auth";
import { importFromProjectJsonIfEmpty } from "@/lib/db/migrateFromJson";
import { UserModel } from "@/lib/db/models";
import { hashPassword } from "@/lib/password";
import { readJsonFile } from "@/lib/storage";
import type { UserRecord } from "@/types/user";

const DEFAULT_USERS: { id: string; username: string; role: Role; plain: string }[] = [
  { id: "admin", username: "admin", role: "admin", plain: "admin123" },
  { id: "df17a049-69a7-4c70-b647-88a752e20d8c", username: "machine", role: "user", plain: "machine123" },
  { id: "demo-operator-001", username: "demo", role: "user", plain: "user123" },
  { id: "2b3c82ff-a9f9-40b2-8eeb-95ba4028d79c", username: "aditya", role: "user", plain: "aditya123" },
  { id: "89c8724c-bced-4522-8912-93d6d55a7b3b", username: "shivose", role: "user", plain: "shivose123" },
  { id: "manager", username: "manager", role: "manager", plain: "manager123" },
  { id: "dashboard", username: "dashboard", role: "dashboard", plain: "dashboard123" },
  { id: "spc-default", username: "SPC", role: "spc", plain: "spc123" },
];

async function seedBuiltInUsers(): Promise<void> {
  if ((await UserModel.countDocuments()) > 0) return;
  const legacy = await readJsonFile<UserRecord[]>("form_users.json", []);
  const now = new Date().toISOString();
  if (legacy.length > 0) {
    for (const r of legacy) {
      const pw = r.password ?? "user123";
      const passwordHash =
        typeof pw === "string" && pw.startsWith("$2")
          ? pw
          : await hashPassword(String(pw));
      await UserModel.create({
        _id: r.id,
        username: r.username,
        passwordHash,
        role: r.role,
        digitalSignaturePng: r.digitalSignaturePng,
        digitalSignaturePasswordHash: r.digitalSignaturePasswordHash,
        createdAt: r.createdAt || now,
        updatedAt: r.updatedAt || now,
      });
    }
    if (!(await UserModel.findOne({ role: "admin" }))) {
      const h = await hashPassword(process.env.INITIAL_ADMIN_PASSWORD?.trim() || "admin123");
      await UserModel.create({
        _id: "admin",
        username: "admin",
        passwordHash: h,
        role: "admin",
        createdAt: now,
        updatedAt: now,
      });
    }
    return;
  }
  for (const u of DEFAULT_USERS) {
    const plain = u.plain || getPasswordForRole(u.role);
    const passwordHash = await hashPassword(plain);
    await UserModel.create({
      _id: u.id,
      username: u.username,
      passwordHash,
      role: u.role,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export async function runDataBootstrap(): Promise<void> {
  await seedBuiltInUsers();
  await importFromProjectJsonIfEmpty();
}
