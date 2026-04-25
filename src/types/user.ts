import type { Role } from "@/lib/auth";

export type UserRecord = {
  id: string;
  username: string;
  /** Only present in legacy file imports; never returned from APIs. */
  password?: string;
  role: Exclude<Role, "admin">;
  createdAt: string;
  updatedAt: string;
  /** PNG data URL drawn at enrollment (admin users UI). */
  digitalSignaturePng?: string;
  /** scrypt hash of the signature unlock password (separate from login password). */
  digitalSignaturePasswordHash?: string;
};

