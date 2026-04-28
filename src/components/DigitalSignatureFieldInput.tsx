"use client";

import * as React from "react";
import { isDigitalSignatureValue, type DigitalSignatureFieldValue } from "@/types/signature";

type Props = {
  value: unknown;
  onChange: (v: DigitalSignatureFieldValue | undefined) => void;
  required?: boolean;
};

/**
 * Clicking opens a password dialog only on demand; successful verification inserts the enrolled signature and a timestamp.
 */
export function DigitalSignatureFieldInput({ value, onChange, required: _required }: Props) {
  const [open, setOpen] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const applied = isDigitalSignatureValue(value);

  async function apply() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/user/signature-unlock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
      credentials: "include",
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      imageDataUrl?: string;
      signedAt?: string;
      signerName?: string;
    };
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Could not apply signature");
      return;
    }
    if (!data.imageDataUrl || !data.signedAt) {
      setError("Invalid response");
      return;
    }
    onChange({ imageDataUrl: data.imageDataUrl, signedAt: data.signedAt, signerName: data.signerName });
    setOpen(false);
    setPassword("");
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        className="ui-btn-secondary w-full max-w-sm justify-center px-4 py-2.5 text-sm"
        onClick={() => {
          setOpen(true);
          setError(null);
          setPassword("");
        }}
      >
        {applied ? "Change applied signature" : "Click to apply digital signature"}
      </button>

      {applied ? (
        <div className="mt-3 rounded-xl border border-zinc-200/90 bg-white p-3 ring-1 ring-zinc-950/[0.03]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value.imageDataUrl}
            alt="Applied signature"
            className="max-h-28 max-w-full object-contain"
          />
          <div className="mt-2 text-xs text-zinc-500">
            {new Date(value.signedAt).toLocaleString()}
          </div>
          {value.signerName ? <div className="mt-1 text-xs text-zinc-500">Signed by: {value.signerName}</div> : null}
          <button
            type="button"
            className="mt-2 text-xs font-medium text-zinc-600 underline hover:text-zinc-900"
            onClick={() => onChange(undefined)}
          >
            Clear
          </button>
        </div>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sig-password-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-zinc-950/50"
            aria-label="Close"
            onClick={() => !loading && setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
            <h3 id="sig-password-title" className="text-base font-semibold text-zinc-900">
              Signature password
            </h3>
            <p className="mt-2 text-sm text-zinc-600">
              Enter the password you set for your digital signature (not your login password).
            </p>
            <input
              type="password"
              className="ui-input mt-4"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void apply();
              }}
              autoFocus
            />
            {error ? <div className="mt-2 text-sm text-red-700">{error}</div> : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="ui-btn-secondary"
                disabled={loading}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button type="button" className="ui-btn-primary" disabled={loading} onClick={() => void apply()}>
                {loading ? "Verifying…" : "Apply signature"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
