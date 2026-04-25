import { promises as fs } from "node:fs";
import path from "node:path";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

async function ensureFile(filePath: string, defaultContents: string) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, defaultContents, "utf8");
  }
}

export async function readJsonFile<T>(fileName: string, fallback: T): Promise<T> {
  const filePath = path.join(process.cwd(), fileName);
  await ensureFile(filePath, JSON.stringify(fallback, null, 2));
  const raw = await fs.readFile(filePath, "utf8");
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonFile<T>(fileName: string, value: T): Promise<void> {
  const filePath = path.join(process.cwd(), fileName);
  const tmpPath = `${filePath}.tmp`;
  const raw = JSON.stringify(value, null, 2);
  await fs.writeFile(tmpPath, raw, "utf8");
  await fs.rename(tmpPath, filePath);
}

