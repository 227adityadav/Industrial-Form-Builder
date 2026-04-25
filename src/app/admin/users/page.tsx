import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/session";
import { listAppUsersForAdmin } from "@/lib/db/users";
import { connectToDatabase } from "@/lib/db/connection";
import { sanitizeUser } from "@/lib/user-sanitize";
import { AdminUsersClient } from "./AdminUsersClient";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await getAuthSession();
  if (session.role !== "admin") {
    redirect("/admin/login?next=/admin/users");
  }
  await connectToDatabase();
  const raw = await listAppUsersForAdmin();
  const initialUsers = raw.map((u) => sanitizeUser(u));
  return <AdminUsersClient initialUsers={initialUsers} />;
}
