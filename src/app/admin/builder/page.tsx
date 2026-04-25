"use client";

import * as React from "react";
import { ColumnTreeEditor } from "@/components/ColumnTreeEditor";
import { DynamicTable } from "@/components/DynamicTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { normalizeFormSchema } from "@/lib/form-schema-normalize";
import { alignGridData, pruneCellRangeBounds } from "@/lib/grid-data";
import { newLeaf } from "@/lib/grid-ops";
import { randomUuid } from "@/lib/random-uuid";
import { defaultGridsFromTemplate } from "@/lib/submission-grids";
import type {
  FieldsSection,
  FormRevealButton,
  FormSchema,
  FormSection,
  GridBlockSection,
  GridCellRangeBoundsEntry,
  GridColumnNode,
  GridData,
  InputType,
  SelectOption,
  TopField,
  TopFieldInputType,
} from "@/types/form-schema";
import { gridCellRangeKey } from "@/types/form-schema";

function findLeafLabel(columns: GridColumnNode[], leafId: string): string | undefined {
  for (const c of columns) {
    if (!c.children?.length) {
      if (c.id === leafId) return c.label;
    } else {
      const hit = findLeafLabel(c.children, leafId);
      if (hit !== undefined) return hit;
    }
  }
  return undefined;
}

function finalizeCellRangeEntry(
  bounds: Record<string, GridCellRangeBoundsEntry> | undefined,
  key: string,
  next: GridCellRangeBoundsEntry
): Record<string, GridCellRangeBoundsEntry> | undefined {
  const out = { ...(bounds ?? {}) };
  const compact: GridCellRangeBoundsEntry = {};
  if (next.skipHighlight) compact.skipHighlight = true;
  if (typeof next.min === "number" && Number.isFinite(next.min)) compact.min = next.min;
  if (typeof next.max === "number" && Number.isFinite(next.max)) compact.max = next.max;
  if (!compact.skipHighlight && compact.min === undefined && compact.max === undefined) {
    delete out[key];
  } else {
    out[key] = compact;
  }
  return Object.keys(out).length ? out : undefined;
}

function defaultSelectOptions(): SelectOption[] {
  return [
    { id: randomUuid(), label: "Option 1", value: "option_1" },
    { id: randomUuid(), label: "Option 2", value: "option_2" },
  ];
}

type TemplateRecord = FormSchema & { updatedAt?: string; createdAt?: string };

function newTemplate(): FormSchema {
  const fieldsId = randomUuid();
  const gridId = randomUuid();
  return normalizeFormSchema({
    id: randomUuid(),
    name: "New Template",
    version: 1,
    sections: [
      { id: fieldsId, kind: "fields", title: "Info fields", fields: [] },
      {
        id: gridId,
        kind: "grid",
        title: "Measurement grid",
        grid: { columns: [newLeaf("Specifications")], rowCount: 6 },
      },
    ],
    footer: { fields: [] },
  });
}

function InputTypePill({ value }: { value: InputType }) {
  return (
    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900/80 ring-1 ring-emerald-700/10">
      {value}
    </span>
  );
}

function RevealBlockAssignSelect({
  revealButtonId,
  buttons,
  onChange,
}: {
  revealButtonId?: string;
  buttons: FormRevealButton[];
  onChange: (next: string | undefined) => void;
}) {
  const validValue = revealButtonId && buttons.some((b) => b.id === revealButtonId) ? revealButtonId : "";
  return (
    <div className="mt-3 rounded-xl border border-zinc-200/80 bg-zinc-50/30 px-3 py-2.5">
      <label className="flex flex-col gap-1.5 text-sm sm:flex-row sm:items-center sm:gap-3">
        <span className="shrink-0 font-medium text-zinc-800">Show this block when the operator taps</span>
        <select
          className="ui-input-compact max-w-md bg-white sm:min-w-[12rem] sm:flex-1"
          value={validValue}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v || undefined);
          }}
        >
          <option value="">Always visible (no button)</option>
          {buttons.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      </label>
      {buttons.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-600">
          Add opener buttons under Template settings to hide this block until the operator opens it.
        </p>
      ) : null}
    </div>
  );
}

function mergeGridDefaultsIntoSchema(schema: FormSchema, gridPreview: Record<string, GridData>): FormSchema {
  return {
    ...schema,
    sections: schema.sections.map((sec) => {
      if (sec.kind !== "grid") return sec;
      const data =
        gridPreview[sec.id] ?? alignGridData(sec.grid.columns, sec.grid.rowCount, sec.grid.defaults ?? []);
      return { ...sec, grid: { ...sec.grid, defaults: data } };
    }),
  };
}

export default function AdminBuilderPage() {
  const bootRef = React.useRef<FormSchema | null>(null);
  if (bootRef.current === null) {
    bootRef.current = newTemplate();
  }
  const initialSchema = bootRef.current;

  const [templates, setTemplates] = React.useState<TemplateRecord[]>([]);
  const [schema, setSchema] = React.useState<FormSchema>(initialSchema);
  const [gridPreview, setGridPreview] = React.useState<Record<string, GridData>>(() =>
    defaultGridsFromTemplate(initialSchema)
  );
  const [status, setStatus] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [rangePickGridId, setRangePickGridId] = React.useState<string | null>(null);
  const [rangePickCell, setRangePickCell] = React.useState<{ row: number; leafId: string } | null>(null);

  async function refreshTemplates() {
    const res = await fetch("/api/templates");
    const data = (await res.json()) as { templates: TemplateRecord[] };
    setTemplates(data.templates);
  }

  React.useEffect(() => {
    void refreshTemplates();
  }, []);

  async function saveTemplate() {
    setLoading(true);
    setStatus(null);
    const payload = mergeGridDefaultsIntoSchema(schema, gridPreview);
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setStatus(data?.error ?? "Failed to save");
      return;
    }
    setStatus("Saved.");
    setSchema(payload);
    await refreshTemplates();
  }

  function updateSectionAt(index: number, next: FormSection) {
    setSchema((s) => ({
      ...s,
      sections: s.sections.map((sec, i) => (i === index ? next : sec)),
    }));
  }

  function moveSection(index: number, delta: -1 | 1) {
    setSchema((s) => {
      const j = index + delta;
      if (j < 0 || j >= s.sections.length) return s;
      const next = [...s.sections];
      [next[index], next[j]] = [next[j]!, next[index]!];
      return { ...s, sections: next };
    });
  }

  function removeSection(index: number) {
    const sec = schema.sections[index];
    if (sec?.kind === "grid") {
      setGridPreview((gp) => {
        const { [sec.id]: _, ...rest } = gp;
        return rest;
      });
    }
    setSchema((s) => ({ ...s, sections: s.sections.filter((_, i) => i !== index) }));
  }

  function addFieldsSection() {
    const block: FieldsSection = {
      id: randomUuid(),
      kind: "fields",
      title: "Info fields",
      fields: [],
    };
    setSchema((s) => ({ ...s, sections: [...s.sections, block] }));
  }

  function addGridSection() {
    const id = randomUuid();
    const grid = { columns: [newLeaf("Specifications")], rowCount: 6 };
    const block: GridBlockSection = { id, kind: "grid", title: "Grid", grid };
    setSchema((s) => ({ ...s, sections: [...s.sections, block] }));
    setGridPreview((gp) => ({ ...gp, [id]: alignGridData(grid.columns, grid.rowCount, []) }));
  }

  function removeRevealButton(buttonId: string) {
    setSchema((s) => ({
      ...s,
      revealButtons: (s.revealButtons ?? []).filter((b) => b.id !== buttonId),
      sections: s.sections.map((sec) => {
        if (sec.kind === "fields" && sec.revealButtonId === buttonId) {
          const { revealButtonId: _r, ...rest } = sec;
          return rest;
        }
        if (sec.kind === "grid" && sec.revealButtonId === buttonId) {
          const { revealButtonId: _r, ...rest } = sec;
          return rest;
        }
        return sec;
      }),
    }));
  }

  function addTopField(sectionIndex: number, section: FieldsSection) {
    const f: TopField = {
      id: randomUuid(),
      label: "New field",
      inputType: "text",
      required: false,
    };
    updateSectionAt(sectionIndex, { ...section, fields: [...section.fields, f] });
  }

  return (
    <div className="app-page">
      <PageHeader
        maxWidth="7xl"
        title="Form builder"
        description="Add info fields and grids. Reorder with Up/Down on each block."
      >
        <a className="ui-btn-secondary" href="/admin/users">
          Users
        </a>
        <a className="ui-btn-secondary" href="/admin/folders">
          Folders
        </a>
        <button
          type="button"
          className="ui-btn-secondary"
          onClick={() => {
            const next = newTemplate();
            setSchema(next);
            setGridPreview(defaultGridsFromTemplate(next));
          }}
        >
          New template
        </button>
        <button type="button" className="ui-btn-primary" onClick={saveTemplate} disabled={loading}>
          {loading ? "Saving…" : "Save template"}
        </button>
        <form
          action={async () => {
            await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
            window.location.assign("/");
          }}
        >
          <button className="ui-btn-secondary" type="submit">
            Log out
          </button>
        </form>
      </PageHeader>

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[300px_1fr]">
        <aside className="ui-card h-fit lg:sticky lg:top-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="ui-section-title">Saved templates</h2>
            <button type="button" className="ui-btn-ghost py-1 text-xs" onClick={refreshTemplates}>
              Refresh
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {templates.length === 0 ? (
              <div className="text-sm text-zinc-600">No templates saved yet.</div>
            ) : (
              templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="rounded-xl border border-zinc-200/90 bg-zinc-50/40 px-3 py-2.5 text-left text-sm transition-colors hover:border-zinc-300 hover:bg-white"
                  onClick={() => {
                    setSchema(t);
                    setGridPreview(defaultGridsFromTemplate(t));
                  }}
                >
                  <div className="font-semibold text-zinc-900">{t.name}</div>
                  <div className="mt-0.5 truncate text-xs text-zinc-500">{t.id}</div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="flex flex-col gap-6">
          {status ? <div className="ui-alert">{status}</div> : null}

          <div className="ui-card">
            <h2 className="ui-section-title">Template settings</h2>
            <div className="mt-4">
              <label className="text-sm font-medium text-zinc-800">
                Name
                <input
                  className="ui-input"
                  value={schema.name}
                  onChange={(e) => setSchema((s) => ({ ...s, name: e.target.value }))}
                />
              </label>
            </div>
            <div className="mt-6 border-t border-zinc-200/90 pt-5">
              <h3 className="text-sm font-semibold text-zinc-900">Section opener buttons</h3>
              <p className="mt-1 text-sm text-zinc-600">
                Create named buttons, then pick one on each info or grid block to keep that block hidden until the
                operator taps the button. Leave blocks on “Always visible” when no button should control them.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {(schema.revealButtons ?? []).map((b) => (
                  <div key={b.id} className="flex flex-wrap items-center gap-2">
                    <input
                      className="ui-input-compact min-w-[10rem] flex-1"
                      aria-label="Opener button label"
                      value={b.label}
                      onChange={(e) =>
                        setSchema((s) => ({
                          ...s,
                          revealButtons: (s.revealButtons ?? []).map((x) =>
                            x.id === b.id ? { ...x, label: e.target.value } : x
                          ),
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="ui-btn-secondary px-2 py-1 text-xs"
                      onClick={() => removeRevealButton(b.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="ui-btn-ghost w-fit py-1.5 text-sm"
                  onClick={() =>
                    setSchema((s) => ({
                      ...s,
                      revealButtons: [
                        ...(s.revealButtons ?? []),
                        { id: randomUuid(), label: "Open section" },
                      ],
                    }))
                  }
                >
                  + Add opener button
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="ui-btn-primary px-3 py-1.5 text-sm" onClick={addFieldsSection}>
              + Info fields block
            </button>
            <button type="button" className="ui-btn-primary px-3 py-1.5 text-sm" onClick={addGridSection}>
              + Grid block
            </button>
          </div>

          {schema.sections.length === 0 ? (
            <div className="ui-card text-sm text-zinc-600">
              No sections yet. Add an info block or grid to build the form body.
            </div>
          ) : null}

          {schema.sections.map((section, sectionIndex) => {
            const isFirst = sectionIndex === 0;
            const isLast = sectionIndex === schema.sections.length - 1;

            if (section.kind === "fields") {
              return (
                <div key={section.id} className="ui-card">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-900/90 ring-1 ring-sky-700/10">
                        Info fields
                      </span>
                      <input
                        className="ui-input-compact min-w-[12rem] max-w-md flex-1"
                        placeholder="Section title"
                        value={section.title ?? ""}
                        onChange={(e) =>
                          updateSectionAt(sectionIndex, { ...section, title: e.target.value || undefined })
                        }
                      />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="ui-btn-secondary px-2 py-1 text-xs"
                        disabled={isFirst}
                        onClick={() => moveSection(sectionIndex, -1)}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="ui-btn-secondary px-2 py-1 text-xs"
                        disabled={isLast}
                        onClick={() => moveSection(sectionIndex, 1)}
                      >
                        Down
                      </button>
                      <button type="button" className="ui-btn-secondary px-2 py-1 text-xs" onClick={() => removeSection(sectionIndex)}>
                        Remove
                      </button>
                      <button
                        type="button"
                        className="ui-btn-primary px-3 py-1.5 text-sm"
                        onClick={() => addTopField(sectionIndex, section)}
                      >
                        + Field
                      </button>
                    </div>
                  </div>

                  <RevealBlockAssignSelect
                    revealButtonId={section.revealButtonId}
                    buttons={schema.revealButtons ?? []}
                    onChange={(next) =>
                      updateSectionAt(
                        sectionIndex,
                        next ? { ...section, revealButtonId: next } : { ...section, revealButtonId: undefined }
                      )
                    }
                  />

                  <div className="mt-4 flex flex-col gap-2">
                    {section.fields.length === 0 ? (
                      <div className="text-sm text-zinc-600">No fields in this block yet.</div>
                    ) : (
                      section.fields.map((f) => (
                        <div
                          key={f.id}
                          className="flex flex-col gap-3 rounded-xl border border-zinc-200/90 bg-zinc-50/30 px-3 py-2 ring-1 ring-zinc-950/[0.03]"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              className="ui-input-compact min-w-56 flex-1"
                              value={f.label}
                              onChange={(e) =>
                                updateSectionAt(sectionIndex, {
                                  ...section,
                                  fields: section.fields.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)),
                                })
                              }
                            />
                            <select
                              className="ui-input-compact bg-white"
                              value={f.inputType}
                              onChange={(e) => {
                                const nextType = e.target.value as TopFieldInputType;
                                updateSectionAt(sectionIndex, {
                                  ...section,
                                  fields: section.fields.map((x) => {
                                    if (x.id !== f.id) return x;
                                    if (nextType === "select" && x.inputType !== "select") {
                                      return {
                                        ...x,
                                        inputType: "select" as const,
                                        options: x.options?.length ? x.options : defaultSelectOptions(),
                                      };
                                    }
                                    if (nextType !== "select" && x.inputType === "select") {
                                      const { options: _o, ...rest } = x;
                                      return { ...rest, inputType: nextType };
                                    }
                                    if (nextType === "signature" && x.inputType !== "signature") {
                                      const { options: _o, ...rest } = x;
                                      return { ...rest, inputType: "signature" as const };
                                    }
                                    if (nextType !== "signature" && x.inputType === "signature") {
                                      return { ...x, inputType: nextType };
                                    }
                                    if (nextType === "file" && x.inputType !== "file") {
                                      const { options: _o, ...rest } = x;
                                      return { ...rest, inputType: "file" as const };
                                    }
                                    if (nextType !== "file" && x.inputType === "file") {
                                      return { ...x, inputType: nextType };
                                    }
                                    return { ...x, inputType: nextType };
                                  }),
                                });
                              }}
                            >
                              <option value="text">Text</option>
                              <option value="number">Number</option>
                              <option value="select">Dropdown</option>
                              <option value="date">Date</option>
                              <option value="toggle">Toggle</option>
                              <option value="signature">Digital signature</option>
                              <option value="file">Photo / document</option>
                            </select>
                            <label className="flex items-center gap-2 text-sm text-zinc-700">
                              <input
                                type="checkbox"
                                checked={!!f.required}
                                onChange={(e) =>
                                  updateSectionAt(sectionIndex, {
                                    ...section,
                                    fields: section.fields.map((x) =>
                                      x.id === f.id ? { ...x, required: e.target.checked } : x
                                    ),
                                  })
                                }
                              />
                              Required
                            </label>
                            <button
                              type="button"
                              className="ui-btn-secondary px-2.5 py-1.5 text-sm"
                              onClick={() =>
                                updateSectionAt(sectionIndex, {
                                  ...section,
                                  fields: section.fields.filter((x) => x.id !== f.id),
                                })
                              }
                            >
                              Remove
                            </button>
                          </div>

                          {f.inputType === "select" ? (
                            <div className="border-t border-zinc-200/80 pt-3">
                              <div className="mb-2 text-xs font-medium text-zinc-600">
                                Dropdown options (label shown to users; value is saved). With 1–3 options, the form shows
                                buttons; 4 or more uses a dropdown.
                              </div>
                              <div className="flex flex-col gap-2">
                                {(f.options ?? []).map((opt) => (
                                  <div key={opt.id} className="flex flex-wrap items-center gap-2">
                                    <input
                                      className="ui-input-compact min-w-[8rem] flex-1"
                                      placeholder="Label"
                                      value={opt.label}
                                      onChange={(e) =>
                                        updateSectionAt(sectionIndex, {
                                          ...section,
                                          fields: section.fields.map((x) =>
                                            x.id !== f.id
                                              ? x
                                              : {
                                                  ...x,
                                                  options: (x.options ?? []).map((o) =>
                                                    o.id === opt.id ? { ...o, label: e.target.value } : o
                                                  ),
                                                }
                                          ),
                                        })
                                      }
                                    />
                                    <input
                                      className="ui-input-compact min-w-[6rem] max-w-[12rem]"
                                      placeholder="Value"
                                      value={opt.value}
                                      onChange={(e) =>
                                        updateSectionAt(sectionIndex, {
                                          ...section,
                                          fields: section.fields.map((x) =>
                                            x.id !== f.id
                                              ? x
                                              : {
                                                  ...x,
                                                  options: (x.options ?? []).map((o) =>
                                                    o.id === opt.id ? { ...o, value: e.target.value } : o
                                                  ),
                                                }
                                          ),
                                        })
                                      }
                                    />
                                    <button
                                      type="button"
                                      className="ui-btn-secondary px-2 py-1 text-xs"
                                      onClick={() =>
                                        updateSectionAt(sectionIndex, {
                                          ...section,
                                          fields: section.fields.map((x) =>
                                            x.id !== f.id
                                              ? x
                                              : {
                                                  ...x,
                                                  options: (x.options ?? []).filter((o) => o.id !== opt.id),
                                                }
                                          ),
                                        })
                                      }
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  className="ui-btn-ghost w-fit py-1.5 text-sm"
                                  onClick={() =>
                                    updateSectionAt(sectionIndex, {
                                      ...section,
                                      fields: section.fields.map((x) =>
                                        x.id !== f.id
                                          ? x
                                          : {
                                              ...x,
                                              options: [
                                                ...(x.options ?? []),
                                                {
                                                  id: randomUuid(),
                                                  label: `Option ${(x.options?.length ?? 0) + 1}`,
                                                  value: `option_${(x.options?.length ?? 0) + 1}`,
                                                },
                                              ],
                                            }
                                      ),
                                    })
                                  }
                                >
                                  + Add option
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            }

            if (section.kind !== "grid") {
              return null;
            }

            const g = section;
            const preview = gridPreview[g.id] ?? alignGridData(g.grid.columns, g.grid.rowCount, g.grid.defaults ?? []);

            return (
              <div key={g.id} className="ui-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-900/90 ring-1 ring-violet-700/10">
                      Grid
                    </span>
                    <input
                      className="ui-input-compact min-w-[12rem] max-w-md flex-1"
                      placeholder="Section title"
                      value={g.title ?? ""}
                      onChange={(e) =>
                        updateSectionAt(sectionIndex, { ...g, title: e.target.value || undefined })
                      }
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      className="ui-btn-secondary px-2 py-1 text-xs"
                      disabled={isFirst}
                      onClick={() => moveSection(sectionIndex, -1)}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="ui-btn-secondary px-2 py-1 text-xs"
                      disabled={isLast}
                      onClick={() => moveSection(sectionIndex, 1)}
                    >
                      Down
                    </button>
                    <button type="button" className="ui-btn-secondary px-2 py-1 text-xs" onClick={() => removeSection(sectionIndex)}>
                      Remove
                    </button>
                    <button
                      type="button"
                      className="ui-btn-primary px-3 py-1.5 text-sm"
                      onClick={() => {
                        const col = newLeaf("New Column");
                        const nextCols = [...g.grid.columns, col];
                        updateSectionAt(sectionIndex, { ...g, grid: { ...g.grid, columns: nextCols } });
                        setGridPreview((prev) => ({
                          ...prev,
                          [g.id]: alignGridData(nextCols, g.grid.rowCount, prev[g.id]),
                        }));
                      }}
                    >
                      + Root column
                    </button>
                  </div>
                </div>

                <RevealBlockAssignSelect
                  revealButtonId={g.revealButtonId}
                  buttons={schema.revealButtons ?? []}
                  onChange={(next) =>
                    updateSectionAt(
                      sectionIndex,
                      next ? { ...g, revealButtonId: next } : { ...g, revealButtonId: undefined }
                    )
                  }
                />

                <label className="mt-4 block text-sm font-medium text-zinc-800">
                  Rows
                  <input
                    className="ui-input mt-1 max-w-[10rem]"
                    type="number"
                    value={g.grid.rowCount}
                    min={1}
                    onChange={(e) => {
                      const rowCount = Math.max(1, Number(e.target.value));
                      const cellRangeBounds = pruneCellRangeBounds(g.grid.cellRangeBounds, g.grid.columns, rowCount);
                      updateSectionAt(sectionIndex, { ...g, grid: { ...g.grid, rowCount, cellRangeBounds } });
                      setGridPreview((prev) => ({
                        ...prev,
                        [g.id]: alignGridData(g.grid.columns, rowCount, prev[g.id]),
                      }));
                    }}
                  />
                </label>

                <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                  Use <span className="font-medium text-zinc-800">Add Sub-column</span> on any header. Leaves split into two
                  children; parents gain another child. Nest as deep as you need.
                </p>

                <div className="mt-5">
                  <ColumnTreeEditor
                    columns={g.grid.columns}
                    setColumns={(cols) => {
                      const cellRangeBounds = pruneCellRangeBounds(
                        g.grid.cellRangeBounds,
                        cols,
                        g.grid.rowCount
                      );
                      updateSectionAt(sectionIndex, { ...g, grid: { ...g.grid, columns: cols, cellRangeBounds } });
                      setGridPreview((prev) => ({
                        ...prev,
                        [g.id]: alignGridData(cols, g.grid.rowCount, prev[g.id]),
                      }));
                    }}
                  />
                </div>

                <div className="mt-8">
                  <div className="mb-3 flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-semibold text-zinc-900">Live preview</span>
                    <span className="text-xs text-zinc-500">auto rowSpan / colSpan</span>
                  </div>
                  <p className="mb-2 text-xs text-zinc-600">
                    Cell values here are saved with the template and pre-fill the form for users; blank cells stay blank.
                  </p>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={
                        rangePickGridId === g.id
                          ? "ui-btn-primary px-3 py-1.5 text-sm"
                          : "ui-btn-secondary px-3 py-1.5 text-sm"
                      }
                      onClick={() => {
                        if (rangePickGridId === g.id) {
                          setRangePickGridId(null);
                          setRangePickCell(null);
                        } else {
                          setRangePickGridId(g.id);
                          setRangePickCell(null);
                        }
                      }}
                    >
                      {rangePickGridId === g.id ? "Done choosing cells" : "Per-cell min / max (range outline)"}
                    </button>
                    {rangePickGridId === g.id ? (
                      <span className="text-xs text-zinc-600">Click a cell, then set bounds or turn off highlight.</span>
                    ) : (
                      <span className="text-xs text-zinc-500">
                        Overrides column min/max for individual cells, or disable outline per cell.
                      </span>
                    )}
                  </div>
                  {rangePickGridId === g.id && rangePickCell ? (
                    <div className="mb-3 rounded-xl border border-violet-200/90 bg-violet-50/40 px-3 py-3 text-sm ring-1 ring-violet-950/[0.04]">
                      <div className="font-medium text-zinc-900">
                        Row {rangePickCell.row + 1} · {findLeafLabel(g.grid.columns, rangePickCell.leafId) || "Column"}
                      </div>
                      <div className="mt-3 flex flex-wrap items-end gap-3">
                        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
                          Cell min
                          <input
                            className="ui-input-compact w-28"
                            type="number"
                            value={
                              (() => {
                                const k = gridCellRangeKey(rangePickCell.row, rangePickCell.leafId);
                                const v = g.grid.cellRangeBounds?.[k]?.min;
                                return v ?? "";
                              })()
                            }
                            onChange={(e) => {
                              const k = gridCellRangeKey(rangePickCell.row, rangePickCell.leafId);
                              const prev = g.grid.cellRangeBounds?.[k] ?? {};
                              const raw = e.target.value;
                              const n = Number(raw);
                              const next: GridCellRangeBoundsEntry = { ...prev };
                              if (raw === "" || !Number.isFinite(n)) delete next.min;
                              else next.min = n;
                              updateSectionAt(sectionIndex, {
                                ...g,
                                grid: {
                                  ...g.grid,
                                  cellRangeBounds: finalizeCellRangeEntry(g.grid.cellRangeBounds, k, next),
                                },
                              });
                            }}
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
                          Cell max
                          <input
                            className="ui-input-compact w-28"
                            type="number"
                            value={
                              (() => {
                                const k = gridCellRangeKey(rangePickCell.row, rangePickCell.leafId);
                                const v = g.grid.cellRangeBounds?.[k]?.max;
                                return v ?? "";
                              })()
                            }
                            onChange={(e) => {
                              const k = gridCellRangeKey(rangePickCell.row, rangePickCell.leafId);
                              const prev = g.grid.cellRangeBounds?.[k] ?? {};
                              const raw = e.target.value;
                              const n = Number(raw);
                              const next: GridCellRangeBoundsEntry = { ...prev };
                              if (raw === "" || !Number.isFinite(n)) delete next.max;
                              else next.max = n;
                              updateSectionAt(sectionIndex, {
                                ...g,
                                grid: {
                                  ...g.grid,
                                  cellRangeBounds: finalizeCellRangeEntry(g.grid.cellRangeBounds, k, next),
                                },
                              });
                            }}
                          />
                        </label>
                        <label className="flex items-center gap-2 text-xs font-medium text-zinc-700">
                          <input
                            type="checkbox"
                            checked={Boolean(
                              g.grid.cellRangeBounds?.[
                                gridCellRangeKey(rangePickCell.row, rangePickCell.leafId)
                              ]?.skipHighlight
                            )}
                            onChange={(e) => {
                              const k = gridCellRangeKey(rangePickCell.row, rangePickCell.leafId);
                              const prev = g.grid.cellRangeBounds?.[k] ?? {};
                              const next: GridCellRangeBoundsEntry = { ...prev };
                              if (e.target.checked) next.skipHighlight = true;
                              else delete next.skipHighlight;
                              updateSectionAt(sectionIndex, {
                                ...g,
                                grid: {
                                  ...g.grid,
                                  cellRangeBounds: finalizeCellRangeEntry(g.grid.cellRangeBounds, k, next),
                                },
                              });
                            }}
                          />
                          No outline for this cell
                        </label>
                        <button
                          type="button"
                          className="ui-btn-secondary px-2.5 py-1.5 text-xs"
                          onClick={() => {
                            const k = gridCellRangeKey(rangePickCell.row, rangePickCell.leafId);
                            const nextMap = { ...(g.grid.cellRangeBounds ?? {}) };
                            delete nextMap[k];
                            updateSectionAt(sectionIndex, {
                              ...g,
                              grid: {
                                ...g.grid,
                                cellRangeBounds: Object.keys(nextMap).length ? nextMap : undefined,
                              },
                            });
                          }}
                        >
                          Clear cell override
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-zinc-600">
                        Empty cell min/max here falls back to the column's number min/max when set. Skip outline
                        ignores both.
                      </p>
                    </div>
                  ) : null}
                  <DynamicTable
                    columns={g.grid.columns}
                    data={preview}
                    onChange={(data) => setGridPreview((prev) => ({ ...prev, [g.id]: data }))}
                    cellRangeBounds={g.grid.cellRangeBounds}
                    rangePickMode={rangePickGridId === g.id}
                    rangeEditSelection={rangePickGridId === g.id ? rangePickCell : null}
                    onPickCellForRange={({ row, leafId }) => setRangePickCell({ row, leafId })}
                  />
                  <div className="mt-3 text-xs text-zinc-600">
                    Leaf columns: {g.grid.columns.length ? "inputs" : "—"} · Types on leaves only (
                    <InputTypePill value="text" /> …)
                  </div>
                </div>
              </div>
            );
          })}

          <div className="ui-card">
            <h2 className="ui-section-title">Footer / workflow</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Footer fields are defined in the schema; dedicated builder controls are planned next.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
