export type Role = "admin" | "user" | "manager" | "dashboard" | "spc";

export const AUTH_COOKIE = "ifb_role";
export const USERNAME_COOKIE = "ifb_username";
/** Opaque server-side session (MongoDB). Issued together with `ifb_role` on login. */
export const SESSION_COOKIE = "ifb_session";

export function isRole(value: unknown): value is Role {
  return (
    value === "admin" ||
    value === "user" ||
    value === "manager" ||
    value === "dashboard" ||
    value === "spc"
  );
}

export function getPasswordForRole(role: Role): string {
  // Demo-only. Replace with proper auth + hashing.
  if (role === "admin") return "admin123";
  if (role === "manager") return "manager123";
  if (role === "dashboard") return "dashboard123";
  if (role === "spc") return "spc123";
  return "user123";
}

