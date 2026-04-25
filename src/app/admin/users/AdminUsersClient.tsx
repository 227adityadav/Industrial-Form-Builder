"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SignaturePad, type SignaturePadHandle } from "@/components/SignaturePad";
import { PageHeader } from "@/components/ui/PageHeader";
import type { SanitizedUser } from "@/lib/user-sanitize";
import {
  adminClearDigitalSignature,
  adminCreateLogin,
  adminDeleteUser,
  adminEnrollDigitalSignature,
} from "./actions";

type Props = {
  initialUsers: SanitizedUser[];
};

export function AdminUsersClient({ initialUsers }: Props) {
  const router = useRouter();
  const users = initialUsers;

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<"user" | "manager">("user");
  const [loginStatus, setLoginStatus] = React.useState<string | null>(null);
  const [signatureStatus, setSignatureStatus] = React.useState<string | null>(null);

  const enrollPadRef = React.useRef<SignaturePadHandle>(null);
  const [enrollInk, setEnrollInk] = React.useState(false);
  const [enrollUserId, setEnrollUserId] = React.useState("");
  const [enrollPwd, setEnrollPwd] = React.useState("");
  const [enrollPwd2, setEnrollPwd2] = React.useState("");
  const [enrollLoading, setEnrollLoading] = React.useState(false);

  const operatorUsers = React.useMemo(() => users.filter((u) => u.role === "user"), [users]);

  React.useEffect(() => {
    if (!enrollUserId && operatorUsers.length > 0) {
      setEnrollUserId(operatorUsers[0]!.id);
    }
  }, [enrollUserId, operatorUsers]);

  async function createLogin() {
    setLoginStatus(null);
    const r = await adminCreateLogin({ username, password, role });
    if (!r.ok) {
      setLoginStatus(r.error);
      return;
    }
    setUsername("");
    setPassword("");
    setRole("user");
    setLoginStatus("User created.");
    router.refresh();
  }

  async function enrollSignature() {
    setEnrollLoading(true);
    setSignatureStatus(null);
    if (!enrollUserId) {
      setSignatureStatus("Choose a user (operator) for this signature.");
      setEnrollLoading(false);
      return;
    }
    if (!enrollInk || !enrollPwd) {
      setSignatureStatus("Draw the signature and set the signature password.");
      setEnrollLoading(false);
      return;
    }
    if (enrollPwd !== enrollPwd2) {
      setSignatureStatus("Signature passwords do not match.");
      setEnrollLoading(false);
      return;
    }
    const dataUrl = enrollPadRef.current?.getDataUrl();
    if (!dataUrl) {
      setSignatureStatus("Draw on the signature pad.");
      setEnrollLoading(false);
      return;
    }
    const r = await adminEnrollDigitalSignature({
      userId: enrollUserId,
      signatureImageDataUrl: dataUrl,
      signaturePassword: enrollPwd,
    });
    setEnrollLoading(false);
    if (!r.ok) {
      setSignatureStatus(r.error);
      return;
    }
    setEnrollPwd("");
    setEnrollPwd2("");
    enrollPadRef.current?.clear();
    setEnrollInk(false);
    setSignatureStatus("Digital signature saved for the selected user.");
    router.refresh();
  }

  async function clearSignature(u: SanitizedUser) {
    if (!confirm(`Remove digital signature for ${u.username}?`)) return;
    setLoginStatus(null);
    setSignatureStatus(null);
    const r = await adminClearDigitalSignature(u.id);
    if (!r.ok) {
      setSignatureStatus(r.error);
      return;
    }
    setSignatureStatus(`Digital signature removed for ${u.username}.`);
    router.refresh();
  }

  async function deleteUser(u: SanitizedUser) {
    setLoginStatus(null);
    const r = await adminDeleteUser(u.id);
    if (!r.ok) {
      setLoginStatus(r.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="app-page">
      <PageHeader
        title="Users & roles"
        description="Create logins separately. Enroll digital signatures in the section below—used only when an operator applies a signature on a form."
      >
        <a className="ui-btn-secondary" href="/admin/builder">
          ← Builder
        </a>
      </PageHeader>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
          <section className="ui-card">
            <h2 className="ui-section-title">Create login</h2>
            <p className="mt-1 text-sm text-zinc-600">Username and password for signing in only.</p>
            <div className="mt-4 flex flex-col gap-4">
              <label className="text-sm font-medium text-zinc-800">
                Username
                <input className="ui-input" value={username} onChange={(e) => setUsername(e.target.value)} />
              </label>
              <label className="text-sm font-medium text-zinc-800">
                Password
                <input
                  className="ui-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                />
              </label>
              <label className="text-sm font-medium text-zinc-800">
                Role
                <select
                  className="ui-input bg-white"
                  value={role}
                  onChange={(e) => setRole(e.target.value as "user" | "manager")}
                >
                  <option value="user">user</option>
                  <option value="manager">manager</option>
                </select>
              </label>
              {loginStatus ? <div className="text-sm text-zinc-700">{loginStatus}</div> : null}
              <button type="button" className="ui-btn-primary w-fit" onClick={() => void createLogin()}>
                Create user
              </button>
            </div>
          </section>

          <section className="ui-card">
            <h2 className="ui-section-title">Existing logins</h2>
            <div className="mt-4 space-y-3">
              {users.length === 0 ? (
                <div className="text-sm text-zinc-600">No users in the list.</div>
              ) : (
                users.map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-col gap-2 rounded-xl border border-zinc-200/90 bg-zinc-50/40 px-4 py-3 ring-1 ring-zinc-950/[0.03] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">{u.username}</div>
                      <div className="text-xs capitalize text-zinc-600">
                        {u.role}
                        {u.hasDigitalSignature ? (
                          <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-900 ring-1 ring-emerald-700/15">
                            Signature enrolled
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {u.hasDigitalSignature ? (
                        <button
                          type="button"
                          className="ui-btn-ghost px-3 py-1.5 text-sm text-red-800 hover:bg-red-50"
                          onClick={() => void clearSignature(u)}
                        >
                          Remove signature
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={
                          u.username === "manager" || u.username === "dashboard" || u.username === "SPC"
                        }
                        className="ui-btn-secondary px-3 py-1.5 text-sm disabled:opacity-45"
                        onClick={() => void deleteUser(u)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="ui-card">
          <h2 className="ui-section-title">Digital signature enrollment</h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-600">
            This is separate from login. Choose an <strong className="font-medium text-zinc-800">operator (user)</strong>,
            draw their signature with mouse or touch, and set the <strong className="font-medium text-zinc-800">signature password</strong>{" "}
            they will enter on forms to place that image with a timestamp. It is not their login password.
          </p>

          {operatorUsers.length === 0 ? (
            <p className="mt-4 text-sm text-amber-800">Create at least one user with role &quot;user&quot; before enrolling a signature.</p>
          ) : (
            <>
              <label className="mt-4 block text-sm font-medium text-zinc-800">
                Operator
                <select
                  className="ui-input mt-1 bg-white"
                  value={enrollUserId}
                  onChange={(e) => setEnrollUserId(e.target.value)}
                >
                  {operatorUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.username}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-4">
                <SignaturePad ref={enrollPadRef} onDrawingChange={setEnrollInk} />
              </div>
              <button
                type="button"
                className="ui-btn-secondary mt-2 px-3 py-1.5 text-sm"
                onClick={() => enrollPadRef.current?.clear()}
              >
                Clear pad
              </button>

              <label className="mt-4 block text-sm font-medium text-zinc-800">
                Signature password (for forms only)
                <input
                  className="ui-input mt-1"
                  type="password"
                  autoComplete="new-password"
                  value={enrollPwd}
                  onChange={(e) => setEnrollPwd(e.target.value)}
                />
              </label>
              <label className="mt-2 block text-sm font-medium text-zinc-800">
                Confirm signature password
                <input
                  className="ui-input mt-1"
                  type="password"
                  autoComplete="new-password"
                  value={enrollPwd2}
                  onChange={(e) => setEnrollPwd2(e.target.value)}
                />
              </label>

              {signatureStatus ? (
                <div className="mt-3 text-sm text-zinc-700">{signatureStatus}</div>
              ) : null}

              <button
                type="button"
                className="ui-btn-primary mt-4 w-fit"
                disabled={enrollLoading}
                onClick={() => void enrollSignature()}
              >
                {enrollLoading ? "Saving…" : "Save digital signature"}
              </button>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
