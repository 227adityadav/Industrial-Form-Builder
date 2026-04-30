"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { DynamicTable } from "@/components/DynamicTable";
import { RevealInstanceEditor } from "@/components/RevealInstanceEditor";
import { PageHeader } from "@/components/ui/PageHeader";
import { splitSubmissionForEdit } from "@/lib/reveal-fills";
import { isUploadedFileFieldValue } from "@/types/file-field";
import { isDigitalSignatureValue } from "@/types/signature";
import type { FooterField, FormSchema, TopField } from "@/types/form-schema";
import type { SubmissionRecord } from "@/types/submission";
import { normalizeSubmissionStatus } from "@/types/submission";

function str(v: unknown) {
  return v == null ? "" : String(v);
}

function formatTopValue(field: TopField, raw: unknown): string {
  if (raw == null) return "";
  if (field.inputType === "toggle") return raw === true ? "Yes" : "No";
  if (field.inputType === "select") {
    const s = String(raw);
    const opt = field.options?.find((o) => o.value === s);
    return opt?.label ?? s;
  }
  return String(raw);
}

function ReadonlyTopField({ field, value }: { field: TopField; value: unknown }) {
  const display = formatTopValue(field, value);

  if (field.inputType === "signature") {
    if (isDigitalSignatureValue(value)) {
      return (
        <div className="text-sm font-medium text-zinc-800">
          <div>{field.label}</div>
          <div className="mt-2 rounded-xl border border-zinc-200/90 bg-white p-3 ring-1 ring-zinc-950/[0.03]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value.imageDataUrl}
              alt="Signature"
              className="max-h-28 max-w-full object-contain"
            />
            <div className="mt-2 text-xs text-zinc-500">
              {new Date(value.signedAt).toLocaleString()}
            </div>
            {value.signerName ? <div className="mt-1 text-xs text-zinc-500">Signed by: {value.signerName}</div> : null}
          </div>
        </div>
      );
    }
    return (
      <label className="text-sm font-medium text-zinc-800">
        {field.label}
        <div className="mt-2 text-sm text-zinc-500">—</div>
      </label>
    );
  }

  if (field.inputType === "file") {
    if (isUploadedFileFieldValue(value)) {
      return (
        <div className="text-sm font-medium text-zinc-800">
          <div>{field.label}</div>
          <div className="mt-2 rounded-xl border border-zinc-200/90 bg-white p-3 ring-1 ring-zinc-950/[0.03]">
            {value.mimeType.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value.dataUrl} alt="" className="max-h-40 max-w-full object-contain" />
            ) : (
              <div className="text-sm">
                <a
                  className="font-medium text-sky-800 underline hover:text-sky-950"
                  href={value.dataUrl}
                  download={value.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {value.fileName}
                </a>
                <span className="ml-2 text-zinc-500">({value.mimeType})</span>
              </div>
            )}
            <div className="mt-2 text-xs text-zinc-500">{new Date(value.uploadedAt).toLocaleString()}</div>
          </div>
        </div>
      );
    }
    return (
      <label className="text-sm font-medium text-zinc-800">
        {field.label}
        <div className="mt-2 text-sm text-zinc-500">—</div>
      </label>
    );
  }

  if (field.inputType === "toggle") {
    return (
      <label className="text-sm font-medium text-zinc-800">
        {field.label}
        <div className="mt-2">
          <input type="checkbox" className="h-4 w-4" checked={Boolean(value)} readOnly tabIndex={-1} />
        </div>
      </label>
    );
  }

  if (field.inputType === "select") {
    const opts = field.options ?? [];
    const useButtons = opts.length > 0 && opts.length < 4;
    const current = value == null ? "" : String(value);
    if (useButtons) {
      return (
        <div className="text-sm font-medium text-zinc-800">
          <div>{field.label}</div>
          <div className="mt-2 flex flex-wrap gap-2" aria-readonly>
            {opts.map((o) => {
              const selected = o.value === current;
              return (
                <span
                  key={o.id}
                  className={
                    selected
                      ? "inline-flex rounded-xl border border-zinc-900 bg-zinc-100 px-3 py-2 text-sm text-zinc-900"
                      : "inline-flex rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-sm text-zinc-500"
                  }
                >
                  {o.label}
                </span>
              );
            })}
          </div>
        </div>
      );
    }
    return (
      <label className="text-sm font-medium text-zinc-800">
        {field.label}
        <select className="ui-input-muted" value={display} disabled>
          <option value={display}>{display}</option>
        </select>
      </label>
    );
  }

  const type = field.inputType === "date" ? "date" : field.inputType === "number" ? "number" : "text";
  return (
    <label className="text-sm font-medium text-zinc-800">
      {field.label}
      <input className="ui-input-muted" type={type} value={display} readOnly tabIndex={-1} />
    </label>
  );
}

function ReadonlyFooterField({ field, value }: { field: FooterField; value: unknown }) {
  if (field.kind === "verification") {
    if (field.inputType === "toggle") {
      return (
        <label className="text-sm font-medium text-zinc-800">
          {field.label}
          <div className="mt-2">
            <input type="checkbox" className="h-4 w-4" checked={Boolean(value)} readOnly tabIndex={-1} />
          </div>
        </label>
      );
    }
    if (field.inputType === "select") {
      const s = value == null ? "" : String(value);
      const opt = field.options?.find((o) => o.value === s);
      const label = opt?.label ?? s;
      return (
        <label className="text-sm font-medium text-zinc-800">
          {field.label}
          <select className="ui-input-muted" value={label} disabled>
            <option value={label}>{label}</option>
          </select>
        </label>
      );
    }
    return (
      <label className="text-sm font-medium text-zinc-800">
        {field.label}
        <input className="ui-input-muted" value={str(value)} readOnly tabIndex={-1} />
      </label>
    );
  }

  if (field.kind === "timestamp") {
    return (
      <label className="text-sm font-medium text-zinc-800">
        {field.label}
        <input className="ui-input-muted" type="datetime-local" value={str(value)} readOnly tabIndex={-1} />
      </label>
    );
  }

  return (
    <label className="text-sm font-medium text-zinc-800">
      {field.label}
      <input className="ui-input-muted" value={str(value)} readOnly tabIndex={-1} />
    </label>
  );
}

export default function UserSubmissionViewPage() {
  const { id } = useParams<{ id: string }>();
  const [submission, setSubmission] = React.useState<SubmissionRecord | null>(null);
  const [template, setTemplate] = React.useState<FormSchema | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function load() {
      const res = await fetch(`/api/submissions/${id}`, { cache: "no-store" });
      if (!res.ok) {
        setError(res.status === 403 ? "You cannot view this submission." : "Submission not found");
        return;
      }
      const data = (await res.json()) as { submission: SubmissionRecord };
      setSubmission(data.submission);
      if (data.submission.templateSnapshot) {
        setTemplate(data.submission.templateSnapshot);
        return;
      }

      const tRes = await fetch(`/api/templates/${data.submission.templateId}`, { cache: "no-store" });
      if (!tRes.ok) {
        setTemplate(null);
        return;
      }
      const tData = (await tRes.json()) as { template: FormSchema };
      setTemplate(tData.template);
    }
    void load();
  }, [id]);

  const viewParts = React.useMemo(() => {
    if (!submission || !template) return null;
    return splitSubmissionForEdit(submission, template);
  }, [submission, template]);

  const gridBySection = viewParts?.baseGrid ?? {};
  const baseTop = viewParts?.baseTop ?? submission?.top ?? {};
  const revealList = viewParts?.revealFills ?? [];

  const statusLabel = submission ? normalizeSubmissionStatus(submission) : null;

  if (error) {
    return (
      <div className="app-page px-6 py-12">
        <div className="ui-alert-error mx-auto max-w-lg">{error}</div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="app-page px-6 py-12">
        <div className="ui-placeholder mx-auto max-w-lg">Loading…</div>
      </div>
    );
  }

  return (
    <div className="app-page">
      <PageHeader
        title={template?.name ?? "Submission"}
        description={`${submission.username ?? "unknown"} · ${new Date(submission.submittedAt).toLocaleString()}`}
      >
        <a className="ui-btn-secondary" href="/forms/history">
          ← View history
        </a>
      </PageHeader>
      <main className="mx-auto w-full max-w-6xl space-y-6 px-6 py-8">
        {statusLabel ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-600">Status:</span>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                statusLabel === "ongoing" ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"
              }`}
            >
              {statusLabel === "ongoing" ? "Ongoing submission" : "Final submission"}
            </span>
          </div>
        ) : null}
        {!template ? (
          <section className="ui-alert text-zinc-700">
            Template not found for this submission, so it can’t be rendered in form layout.
          </section>
        ) : (
          <>
            {template.sections.map((section) => {
              if (section.kind === "fields" && section.revealButtonId) return null;
              if (section.kind === "grid" && section.revealButtonId) return null;

              if (section.kind === "fields") {
                return (
                  <section key={section.id} className="ui-card">
                    <h2 className="ui-section-title">{section.title?.trim() || "Info fields"}</h2>
                    {section.fields.length === 0 ? (
                      <div className="mt-3 text-sm text-zinc-600">No fields in this block.</div>
                    ) : (
                      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {section.fields.map((f) => (
                          <ReadonlyTopField key={f.id} field={f} value={baseTop[f.id]} />
                        ))}
                      </div>
                    )}
                  </section>
                );
              }

              if (section.kind !== "grid") return null;

              const data = gridBySection[section.id] ?? [];
              return (
                <section key={section.id} className="ui-card">
                  <h2 className="ui-section-title">{section.title?.trim() || "Grid"}</h2>
                  <div className="mt-4">
                    <DynamicTable
                      columns={section.grid.columns}
                      data={data}
                      readOnly
                      cellRangeBounds={section.grid.cellRangeBounds}
                    />
                  </div>
                </section>
              );
            })}

            {revealList.length > 0 ? (
              <section className="ui-card space-y-6">
                <h2 className="ui-section-title">Reveal rounds</h2>
                {revealList.map((inst) => {
                  const btnLabel =
                    template.revealButtons?.find((b) => b.id === inst.revealButtonId)?.label ?? "Section";
                  const when = inst.filledAt
                    ? `Filled ${new Date(inst.filledAt).toLocaleString()}`
                    : `Opened ${new Date(inst.openedAt).toLocaleString()}`;
                  return (
                    <div
                      key={inst.id}
                      className="rounded-xl border border-zinc-200/90 bg-zinc-50/30 px-4 py-4 ring-1 ring-zinc-950/[0.03]"
                    >
                      <div className="mb-3 text-sm font-semibold text-zinc-900">
                        {btnLabel}
                        <span className="ml-2 font-normal text-zinc-600">· {when}</span>
                      </div>
                      <RevealInstanceEditor instance={inst} template={template} readOnly sessionRole={null} />
                    </div>
                  );
                })}
              </section>
            ) : null}

            <section className="ui-card">
              <h2 className="ui-section-title">Footer / workflow</h2>
              {template.footer.fields.length === 0 ? (
                <div className="mt-3 text-sm text-zinc-600">No footer fields configured.</div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {template.footer.fields.map((f) => (
                    <ReadonlyFooterField key={f.id} field={f} value={submission.footer[f.id]} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
