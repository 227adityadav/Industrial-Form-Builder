"use client";

import * as React from "react";
import { isUploadedFileFieldValue, type UploadedFileFieldValue } from "@/types/file-field";

const MAX_BYTES = 8 * 1024 * 1024;

const ACCEPT =
  "image/*,application/pdf,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type Props = {
  value: unknown;
  onChange: (v: UploadedFileFieldValue | undefined) => void;
  required?: boolean;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      if (typeof r.result === "string") resolve(r.result);
      else reject(new Error("Could not read file"));
    };
    r.onerror = () => reject(r.error ?? new Error("Read failed"));
    r.readAsDataURL(file);
  });
}

export function FileUploadFieldInput({ value, onChange, required: _required }: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileVal = isUploadedFileFieldValue(value) ? value : null;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError(`File is too large (max ${Math.round(MAX_BYTES / (1024 * 1024))} MB).`);
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      onChange({
        dataUrl,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        uploadedAt: new Date().toISOString(),
      });
    } catch {
      setError("Could not read this file.");
    }
  }

  return (
    <div className="mt-1">
      <input ref={inputRef} type="file" className="sr-only" accept={ACCEPT} onChange={(e) => void onPick(e)} />
      <button
        type="button"
        className="ui-btn-secondary w-full max-w-sm justify-center px-4 py-2.5 text-sm"
        onClick={() => inputRef.current?.click()}
      >
        {fileVal ? "Replace file" : "Upload photo or document"}
      </button>
      <p className="mt-1 text-xs text-zinc-500">Images, PDF, Word (.doc/.docx). Max {MAX_BYTES / (1024 * 1024)} MB.</p>
      {error ? <div className="mt-2 text-sm text-red-700">{error}</div> : null}

      {fileVal ? (
        <div className="mt-3 rounded-xl border border-zinc-200/90 bg-white p-3 ring-1 ring-zinc-950/[0.03]">
          {fileVal.mimeType.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileVal.dataUrl} alt="" className="max-h-40 max-w-full object-contain" />
          ) : (
            <div className="text-sm text-zinc-800">
              <span className="font-medium">{fileVal.fileName}</span>
              <span className="ml-2 text-zinc-500">({fileVal.mimeType || "file"})</span>
            </div>
          )}
          <div className="mt-2 text-xs text-zinc-500">{new Date(fileVal.uploadedAt).toLocaleString()}</div>
          <button
            type="button"
            className="mt-2 text-xs font-medium text-zinc-600 underline hover:text-zinc-900"
            onClick={() => onChange(undefined)}
          >
            Clear
          </button>
        </div>
      ) : null}
    </div>
  );
}
