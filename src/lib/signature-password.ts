import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEYLEN = 64;

/** Format: saltHex:hashHex */
export function hashSignaturePassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifySignaturePassword(plain: string, stored: string | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  if (!salt || !hash) return false;
  try {
    const hashBuf = Buffer.from(hash, "hex");
    const newHash = scryptSync(plain, salt, KEYLEN);
    if (hashBuf.length !== newHash.length) return false;
    return timingSafeEqual(hashBuf, newHash);
  } catch {
    return false;
  }
}
