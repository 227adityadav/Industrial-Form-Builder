import type { UserRecord } from "@/types/user";

export type SanitizedUser = {
  id: string;
  username: string;
  role: UserRecord["role"];
  createdAt: string;
  updatedAt: string;
  hasDigitalSignature: boolean;
  /** Only when explicitly requested (e.g. single-user load for admin). */
  digitalSignaturePng?: string;
};

export function sanitizeUser(u: UserRecord, opts?: { includeSignatureImage?: boolean }): SanitizedUser {
  const hasDigitalSignature = Boolean(u.digitalSignaturePng && u.digitalSignaturePasswordHash);
  const { password: _p, digitalSignaturePasswordHash: _h, ...rest } = u;
  return {
    id: rest.id,
    username: rest.username,
    role: rest.role,
    createdAt: rest.createdAt,
    updatedAt: rest.updatedAt,
    hasDigitalSignature,
    ...(opts?.includeSignatureImage && rest.digitalSignaturePng
      ? { digitalSignaturePng: rest.digitalSignaturePng }
      : {}),
  };
}
