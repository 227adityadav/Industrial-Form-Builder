import { getPasswordForRole } from "@/lib/auth";
import type { Role } from "@/lib/auth";
import { importFromProjectJsonIfEmpty } from "@/lib/db/migrateFromJson";
import { FolderModel, FormTemplateModel, SubmissionModel, SuperSubmissionModel, UserModel } from "@/lib/db/models";
import { hashPassword } from "@/lib/password";
import { readJsonFile } from "@/lib/storage";
import type { UserRecord } from "@/types/user";

const DEFAULT_USERS: { id: string; username: string; role: Role; plain: string }[] = [
  { id: "admin", username: "admin", role: "admin", plain: "admin123" },
  { id: "superadmin", username: "superadmin", role: "superadmin", plain: "superadmin123" },
  { id: "df17a049-69a7-4c70-b647-88a752e20d8c", username: "machine", role: "user", plain: "machine123" },
  { id: "demo-operator-001", username: "demo", role: "user", plain: "user123" },
  { id: "2b3c82ff-a9f9-40b2-8eeb-95ba4028d79c", username: "aditya", role: "user", plain: "aditya123" },
  { id: "89c8724c-bced-4522-8912-93d6d55a7b3b", username: "shivose", role: "user", plain: "shivose123" },
  { id: "manager", username: "manager", role: "manager", plain: "manager123" },
  { id: "dashboard", username: "dashboard", role: "dashboard", plain: "dashboard123" },
  { id: "spc-default", username: "SPC", role: "spc", plain: "spc123" },
  {
    id: "demo-superoperator-001",
    username: "superop",
    role: "superoperator",
    plain: "superoperator123",
  },
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
    if (!(await UserModel.findOne({ role: "superadmin" }))) {
      const h = await hashPassword(process.env.INITIAL_SUPERADMIN_PASSWORD?.trim() || "superadmin123");
      await UserModel.create({
        _id: "superadmin",
        username: "superadmin",
        passwordHash: h,
        role: "superadmin",
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

async function repairSubmissionIdsAndIndex(): Promise<void> {
  const bad = await SubmissionModel.collection
    .find(
      {
        $or: [{ id: null }, { id: "" }, { id: { $exists: false } }],
      },
      { projection: { _id: 1 } }
    )
    .toArray();

  if (bad.length > 0) {
    await SubmissionModel.collection.bulkWrite(
      bad.map((d) => ({
        updateOne: {
          filter: { _id: d._id },
          update: { $set: { id: String(d._id) } },
        },
      }))
    );
  }

  const indexes = await SubmissionModel.collection.indexes();
  const idIdx = indexes.find((i) => i.name === "id_1") as
    | ({ partialFilterExpression?: unknown } & Record<string, unknown>)
    | undefined;
  const hasPartial = Boolean(idIdx?.partialFilterExpression);

  if (!hasPartial) {
    try {
      await SubmissionModel.collection.dropIndex("id_1");
    } catch {
      // ignore if index does not exist yet
    }
    await SubmissionModel.collection.createIndex(
      { id: 1 },
      {
        name: "id_1",
        unique: true,
        partialFilterExpression: { id: { $type: "string" } },
      }
    );
  }
}

async function cleanupDeprecatedTrial3Template(): Promise<void> {
  const deprecatedTemplates = await FormTemplateModel.collection
    .find(
      { name: { $regex: /^\s*trial\s*3\s*$/i } },
      { projection: { id: 1 } }
    )
    .toArray();
  const templateIds = deprecatedTemplates
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  if (templateIds.length === 0) return;

  await FormTemplateModel.collection.deleteMany({ id: { $in: templateIds } });
  const removeFromFolders: Record<string, unknown> = {
    $pull: { templateIds: { $in: templateIds } },
  };
  await FolderModel.collection.updateMany(
    { templateIds: { $in: templateIds } },
    removeFromFolders
  );
  await SubmissionModel.collection.deleteMany({ templateId: { $in: templateIds } });
}

async function ensureSuperAdminUser(): Promise<void> {
  if (await UserModel.findOne({ role: "superadmin" })) return;
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(process.env.INITIAL_SUPERADMIN_PASSWORD?.trim() || "superadmin123");
  await UserModel.create({
    _id: "superadmin",
    username: "superadmin",
    passwordHash,
    role: "superadmin",
    createdAt: now,
    updatedAt: now,
  });
}

async function ensureSuperOperatorUser(): Promise<void> {
  if (await UserModel.findOne({ role: "superoperator" })) return;
  const now = new Date().toISOString();
  const passwordHash = await hashPassword("superoperator123");
  await UserModel.create({
    _id: "demo-superoperator-001",
    username: "superop",
    passwordHash,
    role: "superoperator",
    createdAt: now,
    updatedAt: now,
  });
}

async function repairSuperSubmissionIdsAndIndex(): Promise<void> {
  const bad = await SuperSubmissionModel.collection
    .find(
      {
        $or: [{ id: null }, { id: "" }, { id: { $exists: false } }],
      },
      { projection: { _id: 1 } }
    )
    .toArray();

  if (bad.length > 0) {
    await SuperSubmissionModel.collection.bulkWrite(
      bad.map((d) => ({
        updateOne: {
          filter: { _id: d._id },
          update: { $set: { id: String(d._id) } },
        },
      }))
    );
  }

  const indexes = await SuperSubmissionModel.collection.indexes();
  const idIdx = indexes.find((i) => i.name === "id_1") as
    | ({ partialFilterExpression?: unknown } & Record<string, unknown>)
    | undefined;
  const hasPartial = Boolean(idIdx?.partialFilterExpression);

  if (!hasPartial) {
    try {
      await SuperSubmissionModel.collection.dropIndex("id_1");
    } catch {
      // ignore if index does not exist yet
    }
    await SuperSubmissionModel.collection.createIndex(
      { id: 1 },
      {
        name: "id_1",
        unique: true,
        partialFilterExpression: { id: { $type: "string" } },
      }
    );
  }
}

export async function runDataBootstrap(): Promise<void> {
  await seedBuiltInUsers();
  await ensureSuperAdminUser();
  await ensureSuperOperatorUser();
  await importFromProjectJsonIfEmpty();
  await cleanupDeprecatedTrial3Template();
  await repairSubmissionIdsAndIndex();
  await repairSuperSubmissionIdsAndIndex();
}
