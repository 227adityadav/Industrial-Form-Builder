"use client";

import * as React from "react";
import { useForm, type UseFormSetValue } from "react-hook-form";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DynamicTable } from "@/components/DynamicTable";
import { renderTopInput, type TopFormLike } from "@/components/form-top-inputs";
import {
  RevealInstanceEditor,
  type RevealInstanceEditorHandle,
} from "@/components/RevealInstanceEditor";
import { PageHeader } from "@/components/ui/PageHeader";
import { alignGridData } from "@/lib/grid-data";
import type { Role } from "@/lib/auth";
import {
  baseFieldIds,
  baseGridSectionIds,
  defaultBaseGridsFromTemplate,
  emptyRevealFillInstance,
  splitSubmissionForEdit,
} from "@/lib/reveal-fills";
import { parseSubmissionGrids } from "@/lib/submission-grids";
import type { FormSchema, GridBlockSection, GridData, TopField } from "@/types/form-schema";
import type { RevealFillInstance, SubmissionRecord } from "@/types/submission";
import { normalizeSubmissionStatus } from "@/types/submission";

type FormEntryValues = TopFormLike & {
  footer: Record<string, unknown>;
};

type TopInputPriorOptions = {
  priorTop: Record<string, unknown> | null;
  setValue: UseFormSetValue<FormEntryValues>;
};

export default function FillFormPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const id = params.id;
  const folderId = search.get("folderId") ?? undefined;
  const submissionId = search.get("submissionId");

  const [template, setTemplate] = React.useState<FormSchema | null>(null);
  const [gridBySection, setGridBySection] = React.useState<Record<string, GridData>>({});
  const [revealFills, setRevealFills] = React.useState<RevealFillInstance[]>([]);
  const revealRefs = React.useRef<Map<string, RevealInstanceEditorHandle>>(new Map());

  const [status, setStatus] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [blockedEdit, setBlockedEdit] = React.useState(false);
  const [existingId, setExistingId] = React.useState<string | null>(null);
  const [priorSubmission, setPriorSubmission] = React.useState<SubmissionRecord | null>(null);
  const [sessionRole, setSessionRole] = React.useState<Role | null>(null);

  const form = useForm<FormEntryValues>({ defaultValues: { top: {}, footer: {} } });

  const priorGridBySection = React.useMemo(() => {
    if (!template || !priorSubmission) return null;
    const full = parseSubmissionGrids(priorSubmission.grid, template);
    const out: Record<string, GridData> = {};
    for (const bid of baseGridSectionIds(template)) {
      const sec = template.sections.find((s) => s.id === bid && s.kind === "grid") as
        | GridBlockSection
        | undefined;
      if (!sec) continue;
      out[bid] = full[bid] ?? alignGridData(sec.grid.columns, sec.grid.rowCount, []);
    }
    return out;
  }, [template, priorSubmission]);

  const priorTopRecord = React.useMemo(() => {
    if (!priorSubmission?.top || !template) return null;
    const allow = baseFieldIds(template);
    const out: Record<string, unknown> = {};
    for (const k of allow) {
      if (k in priorSubmission.top) out[k] = priorSubmission.top[k];
    }
    return Object.keys(out).length ? out : null;
  }, [priorSubmission, template]);

  const topPriorOptions: TopInputPriorOptions = {
    priorTop: priorTopRecord,
    setValue: form.setValue,
  };

  const openerButtons = React.useMemo(() => {
    if (!template) return [];
    const defs = template.revealButtons ?? [];
    const used = new Set<string>();
    for (const sec of template.sections) {
      if ((sec.kind === "fields" || sec.kind === "grid") && sec.revealButtonId) {
        if (defs.some((b) => b.id === sec.revealButtonId)) used.add(sec.revealButtonId);
      }
    }
    return defs.filter((b) => used.has(b.id));
  }, [template]);

  const openRounds = React.useMemo(() => revealFills.filter((f) => !f.filledAt), [revealFills]);
  const filledRounds = React.useMemo(
    () =>
      [...revealFills.filter((f) => f.filledAt)].sort(
        (a, b) => new Date(b.filledAt!).getTime() - new Date(a.filledAt!).getTime()
      ),
    [revealFills]
  );

  function collectRevealFillsFromEditors(): RevealFillInstance[] {
    return revealFills.map((f) => {
      if (f.filledAt) return f;
      return revealRefs.current.get(f.id)?.collect() ?? f;
    });
  }

  function markRoundFilled(instanceId: string) {
    const collected = collectRevealFillsFromEditors();
    setRevealFills(
      collected.map((f) =>
        f.id === instanceId && !f.filledAt ? { ...f, filledAt: new Date().toISOString() } : f
      )
    );
  }

  function removeOpenRound(instanceId: string) {
    revealRefs.current.delete(instanceId);
    setRevealFills((prev) => prev.filter((f) => f.id !== instanceId));
  }

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus(null);
      setBlockedEdit(false);
      setExistingId(null);
      setPriorSubmission(null);

      const [res, meRes] = await Promise.all([
        fetch(`/api/templates/${id}`, { cache: "no-store" }),
        fetch("/api/auth/me", { cache: "no-store" }),
      ]);
      if (!res.ok) {
        if (!cancelled) setStatus("Template not found.");
        return;
      }
      const data = (await res.json()) as { template: FormSchema };
      if (cancelled) return;
      const loadedTemplate = data.template;
      setTemplate(loadedTemplate);

      if (meRes.ok) {
        const me = (await meRes.json()) as { role?: Role };
        if (!cancelled && me.role) setSessionRole(me.role);
      } else if (!cancelled) {
        setSessionRole(null);
      }

      if (submissionId) {
        const [sRes, listRes] = await Promise.all([
          fetch(`/api/submissions/${submissionId}`, { cache: "no-store" }),
          fetch("/api/submissions", { cache: "no-store" }),
        ]);
        if (!sRes.ok) {
          if (!cancelled) setStatus("Could not load this submission.");
          return;
        }
        if (!listRes.ok) {
          if (!cancelled) setStatus("Could not verify edit permission.");
          return;
        }
        const { submission: sub } = (await sRes.json()) as { submission: SubmissionRecord };
        if (cancelled) return;
        if (sub.templateId !== id) {
          if (typeof sub.templateId === "string" && sub.templateId.trim().length > 0) {
            const next = new URLSearchParams();
            next.set("submissionId", sub.id);
            if (sub.folderId) next.set("folderId", sub.folderId);
            const qs = next.toString();
            router.replace(qs ? `/forms/${encodeURIComponent(sub.templateId)}?${qs}` : `/forms/${encodeURIComponent(sub.templateId)}`);
            return;
          }
          setStatus("This submission is missing its form reference and cannot be opened.");
          return;
        }

        const templateForSubmission = sub.templateSnapshot ?? loadedTemplate;
        const listData = (await listRes.json()) as { submissions?: SubmissionRecord[] };
        const list = listData.submissions ?? [];
        const byRecency = (a: SubmissionRecord, b: SubmissionRecord) => {
          const ta = new Date(a.updatedAt ?? a.submittedAt).getTime();
          const tb = new Date(b.updatedAt ?? b.submittedAt).getTime();
          return tb - ta;
        };
        const sorted = [...list].sort(byRecency);
        const mostRecentId = sorted[0]?.id;

        const formFolderId = sub.folderId ?? folderId;
        const prior = [...list]
          .filter((s) => {
            if (s.id === sub.id || s.templateId !== id) return false;
            if (formFolderId !== undefined && formFolderId !== "") {
              return s.folderId === formFolderId;
            }
            return s.folderId === undefined || s.folderId === "";
          })
          .sort(byRecency)[0];
        if (!cancelled) setPriorSubmission(prior ?? null);
        if (
          normalizeSubmissionStatus(sub) === "final" &&
          mostRecentId !== undefined &&
          sub.id !== mostRecentId
        ) {
          setBlockedEdit(true);
          setStatus(
            "Only your most recent submission can be edited. Open View history for read-only details on older finals."
          );
          return;
        }

        setExistingId(sub.id);
        const split = splitSubmissionForEdit(sub, templateForSubmission);
        form.reset({
          top: split.baseTop as FormEntryValues["top"],
          footer: (sub.footer ?? {}) as FormEntryValues["footer"],
        });
        setGridBySection(split.baseGrid);
        setRevealFills(split.revealFills);
        setTemplate(templateForSubmission);
      } else {
        form.reset({ top: {}, footer: {} });
        setGridBySection(defaultBaseGridsFromTemplate(data.template));
        setRevealFills([]);

        const priorParams = new URLSearchParams({
          templateId: id,
          limit: "1",
        });
        if (folderId) priorParams.set("folderId", folderId);

        const sugRes = await fetch(`/api/submissions?${priorParams.toString()}`, {
          cache: "no-store",
        });
        if (sugRes.ok) {
          const sugData = (await sugRes.json()) as { submissions?: SubmissionRecord[] };
          const one = sugData.submissions?.[0];
          if (!cancelled) setPriorSubmission(one ?? null);
        } else if (!cancelled) {
          setPriorSubmission(null);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when template id or submission id changes
  }, [id, submissionId, folderId]);

  async function persist(values: FormEntryValues, submissionStatus: "ongoing" | "final") {
    if (!template || isSaving) return;
    setIsSaving(true);
    try {
      setStatus("Saving...");

      const collectedFills = collectRevealFillsFromEditors();
      setRevealFills(collectedFills);

      const payload = {
        templateId: template.id,
        folderId,
        top: values.top ?? {},
        grid: gridBySection,
        footer: values.footer ?? {},
        revealFills: collectedFills,
        submissionStatus,
      };

      if (existingId) {
        const res = await fetch(`/api/submissions/${existingId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            top: payload.top,
            grid: payload.grid,
            footer: payload.footer,
            revealFills: payload.revealFills,
            submissionStatus,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setStatus(data?.error ?? "Save failed.");
          return;
        }
      } else {
        const res = await fetch("/api/submissions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setStatus(data?.error ?? "Save failed.");
          return;
        }
        const data = (await res.json()) as { submission?: SubmissionRecord };
        if (data.submission?.id) {
          setExistingId(data.submission.id);
          const next = new URLSearchParams();
          next.set("submissionId", data.submission.id);
          if (folderId) next.set("folderId", folderId);
          router.replace(`/forms/${encodeURIComponent(template.id)}?${next.toString()}`);
        }
      }

      if (submissionStatus === "final") {
        setStatus("Final submission recorded.");
        router.push("/forms");
        return;
      }
      setStatus("Ongoing submission saved. You can continue here or find it under Ongoing.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="app-page">
      <PageHeader
        title={template?.name ?? "Loading..."}
        description={
          existingId
            ? "Editing a saved submission — use Ongoing submission to keep a draft or Final submission when complete."
            : "Data entry — use Tab to move across cells in the grid. Add reveal rounds as needed, mark each filled entry when done, then submit."
        }
      >
        <button className="ui-btn-secondary" type="button" onClick={() => router.push("/forms")}>
          &larr; Folders
        </button>
      </PageHeader>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        {status ? <div className="ui-alert">{status}</div> : null}

        {!template ? (
          <div className="ui-placeholder">Loading...</div>
        ) : blockedEdit ? null : (
          <form className="flex flex-col gap-6">
            {openerButtons.length > 0 ? (
              <div className="ui-card flex flex-col gap-3">
                <h2 className="ui-section-title">Open new rounds</h2>
                <p className="text-sm text-zinc-600">
                  Each click starts a new copy of the linked sections. Fill it, then use &quot;Mark this entry
                  filled&quot; so it moves to the filled list (with time). You can open the same button again for
                  another round. If you opened one by mistake, use the &times; on that block to remove it.
                </p>
                <div className="flex flex-wrap gap-2">
                  {openerButtons.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      className="rounded-xl border border-zinc-900 bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm ring-1 ring-zinc-900/10 hover:bg-zinc-50"
                      onClick={() =>
                        setRevealFills((prev) => [...prev, emptyRevealFillInstance(template, b.id)])
                      }
                    >
                      + {b.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {openRounds.length > 0 ? (
              <div className="flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-zinc-900">Open entries (in progress)</h2>
                {openRounds.map((inst) => {
                  const btnLabel =
                    template.revealButtons?.find((b) => b.id === inst.revealButtonId)?.label ?? "Section";
                  return (
                    <div
                      key={inst.id}
                      className="relative ui-card flex flex-col gap-4 border-amber-200/80 pr-11 pt-1 ring-1 ring-amber-900/5"
                    >
                      <button
                        type="button"
                        className="absolute right-2 top-2 z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-xl leading-none text-zinc-500 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                        aria-label="Remove this open entry"
                        title="Remove this open entry"
                        onClick={() => removeOpenRound(inst.id)}
                      >
                        &times;
                      </button>
                      <div className="flex flex-wrap items-center justify-between gap-2 pr-6 sm:pr-0">
                        <div className="text-sm text-zinc-600">
                          <span className="font-semibold text-zinc-900">{btnLabel}</span>
                          <span className="mx-2 text-zinc-400">·</span>
                          Opened {new Date(inst.openedAt).toLocaleString()}
                        </div>
                        <button
                          type="button"
                          className="ui-btn-primary px-3 py-1.5 text-sm"
                          onClick={() => markRoundFilled(inst.id)}
                        >
                          Mark this entry filled
                        </button>
                      </div>
                      <RevealInstanceEditor
                        ref={(node) => {
                          if (node) revealRefs.current.set(inst.id, node);
                          else revealRefs.current.delete(inst.id);
                        }}
                        instance={inst}
                        template={template}
                        sessionRole={sessionRole}
                      />
                    </div>
                  );
                })}
              </div>
            ) : null}

            {template.sections.map((section) => {
              if (section.kind === "fields" && section.revealButtonId) return null;
              if (section.kind === "grid" && section.revealButtonId) return null;

              if (section.kind === "fields") {
                return (
                  <section key={section.id} className="ui-card">
                    <h2 className="ui-section-title">{section.title?.trim() || "Info fields"}</h2>
                    {section.fields.length === 0 ? (
                      <div className="mt-2 text-sm text-zinc-600">No fields in this block.</div>
                    ) : (
                      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {section.fields.map((f: TopField) =>
                          f.inputType === "signature" || f.inputType === "file" ? (
                            <div key={f.id} className="text-sm font-medium text-zinc-800">
                              <div>{f.label}</div>
                              {renderTopInput(f, form.register, form.control, topPriorOptions)}
                            </div>
                          ) : (
                            <label key={f.id} className="text-sm font-medium text-zinc-800">
                              {f.label}
                              {renderTopInput(f, form.register, form.control, topPriorOptions)}
                            </label>
                          )
                        )}
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
                      cellRangeBounds={section.grid.cellRangeBounds}
                      suggestionGrid={priorGridBySection?.[section.id] ?? null}
                      templateDefaultsGrid={alignGridData(
                        section.grid.columns,
                        section.grid.rowCount,
                        section.grid.defaults ?? []
                      )}
                      lockPrefilledFromTemplate={sessionRole !== "manager"}
                      onChange={(next) =>
                        setGridBySection((prev) => ({
                          ...prev,
                          [section.id]: next,
                        }))
                      }
                    />
                  </div>
                </section>
              );
            })}

            {filledRounds.length > 0 ? (
              <div className="ui-card flex flex-col gap-4">
                <h2 className="ui-section-title">Filled entries</h2>
                <p className="text-sm text-zinc-600">
                  Completed rounds for each opener button. Multiple fills of the same button are listed with their
                  filled time.
                </p>
                <div className="flex flex-col gap-6">
                  {filledRounds.map((inst) => {
                    const btnLabel =
                      template.revealButtons?.find((b) => b.id === inst.revealButtonId)?.label ?? "Section";
                    return (
                      <div
                        key={inst.id}
                        className="rounded-xl border border-emerald-200/90 bg-emerald-50/20 px-4 py-4 ring-1 ring-emerald-950/[0.04]"
                      >
                        <div className="mb-3 text-sm font-semibold text-emerald-950">
                          {btnLabel}
                          <span className="ml-2 font-normal text-emerald-900/80">
                            · Filled {inst.filledAt ? new Date(inst.filledAt).toLocaleString() : ""}
                          </span>
                        </div>
                        <RevealInstanceEditor
                          instance={inst}
                          template={template}
                          readOnly
                          sessionRole={sessionRole}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <section className="ui-card">
              <h2 className="ui-section-title">Footer / workflow</h2>
              <div className="mt-3 text-sm leading-relaxed text-zinc-600">
                Footer fields are defined in the schema; dedicated builder controls are planned next.
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                className="ui-btn-secondary px-6"
                disabled={isSaving}
                onClick={() => void form.handleSubmit((v) => persist(v, "ongoing"))()}
              >
                Ongoing submission
              </button>
              <button
                type="button"
                className="ui-btn-primary px-6"
                disabled={isSaving}
                onClick={() => void form.handleSubmit((v) => persist(v, "final"))()}
              >
                Final submission
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
