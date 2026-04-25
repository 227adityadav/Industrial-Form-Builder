"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { DynamicTable } from "@/components/DynamicTable";
import { renderTopInput, type TopFormLike } from "@/components/form-top-inputs";
import { alignGridData } from "@/lib/grid-data";
import { sectionsForRevealButton } from "@/lib/reveal-fills";
import type { Role } from "@/lib/auth";
import type { FormSchema, GridBlockSection, GridData } from "@/types/form-schema";
import type { RevealFillInstance } from "@/types/submission";

export type RevealInstanceEditorHandle = {
  collect: () => RevealFillInstance;
};

type Props = {
  instance: RevealFillInstance;
  template: FormSchema;
  readOnly?: boolean;
  /** When false, operator can mark round complete from parent. */
  sessionRole: Role | null;
};

export const RevealInstanceEditor = React.forwardRef<RevealInstanceEditorHandle, Props>(
  function RevealInstanceEditor({ instance, template, readOnly, sessionRole }, ref) {
    const form = useForm<TopFormLike>({ defaultValues: { top: instance.top } });
    const [grids, setGrids] = React.useState<Record<string, GridData>>(() => ({ ...instance.grid }));

    React.useEffect(() => {
      form.reset({ top: instance.top });
      setGrids({ ...instance.grid });
    }, [instance.id, form, instance.top, instance.grid]);

    React.useImperativeHandle(
      ref,
      () => ({
        collect: () => ({
          ...instance,
          top: form.getValues("top") as Record<string, unknown>,
          grid: { ...grids },
        }),
      }),
      [instance, form, grids]
    );

    const secs = sectionsForRevealButton(template, instance.revealButtonId);

    if (readOnly) {
      return (
        <div className="flex flex-col gap-4">
          {secs.map((section) => {
            if (section.kind === "fields") {
              return (
                <div key={section.id}>
                  <h3 className="text-sm font-semibold text-zinc-900">{section.title?.trim() || "Info fields"}</h3>
                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {section.fields.map((f) => (
                      <div key={f.id} className="text-sm text-zinc-700">
                        <div className="font-medium text-zinc-800">{f.label}</div>
                        <div className="mt-0.5 break-words text-zinc-600">
                          {formatReadonlyTop(f, instance.top[f.id])}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            const g = section as GridBlockSection;
            const data = grids[g.id] ?? [];
            return (
              <div key={g.id}>
                <h3 className="text-sm font-semibold text-zinc-900">{g.title?.trim() || "Grid"}</h3>
                <div className="mt-2">
                  <DynamicTable columns={g.grid.columns} data={data} readOnly cellRangeBounds={g.grid.cellRangeBounds} />
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-4">
        {secs.map((section) => {
          if (section.kind === "fields") {
            return (
              <div key={section.id}>
                <h3 className="text-sm font-semibold text-zinc-900">{section.title?.trim() || "Info fields"}</h3>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {section.fields.map((f) =>
                    f.inputType === "signature" || f.inputType === "file" ? (
                      <div key={f.id} className="text-sm font-medium text-zinc-800">
                        <div>{f.label}</div>
                        {renderTopInput(f, form.register, form.control, undefined, instance.id)}
                      </div>
                    ) : (
                      <label key={f.id} className="text-sm font-medium text-zinc-800">
                        {f.label}
                        {renderTopInput(f, form.register, form.control, undefined, instance.id)}
                      </label>
                    )
                  )}
                </div>
              </div>
            );
          }
          const g = section as GridBlockSection;
          const data = grids[g.id] ?? alignGridData(g.grid.columns, g.grid.rowCount, []);
          return (
            <div key={g.id}>
              <h3 className="text-sm font-semibold text-zinc-900">{g.title?.trim() || "Grid"}</h3>
              <div className="mt-3">
                <DynamicTable
                  columns={g.grid.columns}
                  data={data}
                  cellRangeBounds={g.grid.cellRangeBounds}
                  templateDefaultsGrid={alignGridData(
                    g.grid.columns,
                    g.grid.rowCount,
                    g.grid.defaults ?? []
                  )}
                  lockPrefilledFromTemplate={sessionRole !== "manager"}
                  onChange={(next) => {
                    setGrids((prev) => ({ ...prev, [g.id]: next }));
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }
);

function formatReadonlyTop(field: { label: string; inputType: string; options?: { label: string; value: string }[] }, raw: unknown): string {
  if (raw == null || raw === "") return "—";
  if (field.inputType === "toggle") return raw === true ? "Yes" : raw === false ? "No" : "—";
  if (field.inputType === "select") {
    const v = String(raw);
    const opt = field.options?.find((o) => o.value === v);
    return opt?.label ?? v;
  }
  return String(raw);
}
