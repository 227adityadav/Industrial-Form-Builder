import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { connectToDatabase } from "../src/lib/db/connection";
import {
  FolderModel,
  FormTemplateModel,
  MasterFolderModel,
  RefillNotificationModel,
  SessionModel,
  SubmissionModel,
  UserModel,
} from "../src/lib/db/models";

const JSON_RESET_FILES = [
  "form_users.json",
  "form_templates.json",
  "form_folders.json",
  "form_master_folders.json",
  "form_submissions.json",
  "form_refill_notifications.json",
];

async function loadEnvLocalIfPresent(): Promise<void> {
  const envPath = path.join(process.cwd(), ".env.local");
  try {
    const raw = await readFile(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // no local env file
  }
}

async function resetJsonFiles(): Promise<void> {
  const root = process.cwd();
  await Promise.all(
    JSON_RESET_FILES.map(async (file) => {
      const filePath = path.join(root, file);
      await writeFile(filePath, "[]\n", "utf8");
    })
  );
}

async function resetDatabase(): Promise<void> {
  await connectToDatabase();
  await Promise.all([
    SubmissionModel.deleteMany({}),
    RefillNotificationModel.deleteMany({}),
    FolderModel.deleteMany({}),
    MasterFolderModel.deleteMany({}),
    FormTemplateModel.deleteMany({}),
    SessionModel.deleteMany({}),
    UserModel.deleteMany({}),
  ]);
}

async function main(): Promise<void> {
  await loadEnvLocalIfPresent();
  if (!process.env.NODE_ENV) process.env.NODE_ENV = "development";
  await resetDatabase();
  await resetJsonFiles();
  console.log("Hard reset complete: users, sessions, templates, folders, submissions, and refill records deleted.");
}

main().catch((error: unknown) => {
  console.error("Hard reset failed:", error);
  process.exitCode = 1;
});
