"use client";

import {
  Controller,
  type Control,
  type FieldPath,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";
import { DigitalSignatureFieldInput } from "@/components/DigitalSignatureFieldInput";
import { FileUploadFieldInput } from "@/components/FileUploadFieldInput";
import { InfoFieldPriorChip, priorPresentForTop, topFieldValuesMatch } from "@/components/InfoFieldPriorChip";
import { isUploadedFileFieldValue } from "@/types/file-field";
import { isDigitalSignatureValue } from "@/types/signature";
import type { InputType, TopField } from "@/types/form-schema";

export type TopFormLike = { top: Record<string, unknown> };

export type TopInputPriorOptions<T extends TopFormLike = TopFormLike> = {
  priorTop: Record<string, unknown> | null;
  setValue: UseFormSetValue<T>;
};

export function renderTopInput<T extends TopFormLike>(
  field: TopField,
  register: UseFormRegister<T>,
  control: Control<T>,
  priorOptions?: TopInputPriorOptions<T>,
  /** Unique suffix for aria/html ids when multiple editors mount (e.g. reveal instance id). */
  htmlIdSuffix = ""
) {
  const topPath = `top.${field.id}` as FieldPath<T>;
  const chipHtmlId = (base: string) => (htmlIdSuffix ? `${base}-${htmlIdSuffix}` : base);
  const canPrior = priorOptions?.priorTop != null && priorOptions.setValue != null;
  const priorRaw = canPrior ? priorOptions!.priorTop![field.id] : undefined;

  if (field.inputType === "signature") {
    return (
      <Controller
        name={topPath}
        control={control}
        rules={{
          validate: (v) => {
            if (!field.required) return true;
            return isDigitalSignatureValue(v) || "Signature required";
          },
        }}
        render={({ field: ctl }) => (
          <DigitalSignatureFieldInput
            value={ctl.value}
            onChange={ctl.onChange}
            required={field.required}
          />
        )}
      />
    );
  }

  if (field.inputType === "file") {
    return (
      <Controller
        name={topPath}
        control={control}
        rules={{
          validate: (v) => {
            if (!field.required) return true;
            return isUploadedFileFieldValue(v) || "A file is required";
          },
        }}
        render={({ field: ctl }) => (
          <FileUploadFieldInput value={ctl.value} onChange={ctl.onChange} required={field.required} />
        )}
      />
    );
  }

  const setValue = priorOptions?.setValue;

  switch (field.inputType as InputType) {
    case "number": {
      if (!canPrior) {
        return <input type="number" {...register(topPath, { required: field.required })} className="ui-input" />;
      }
      const prior = priorRaw;
      return (
        <Controller
          name={topPath}
          control={control}
          rules={{ required: field.required ? "Required" : false }}
          render={({ field: ctl }) => {
            const show =
              priorPresentForTop(prior, "number") && !topFieldValuesMatch(ctl.value, prior, "number");
            return (
              <div className={`group/info relative ${show ? "pt-1" : ""}`}>
                <input
                  type="number"
                  autoComplete="off"
                  className={`ui-input ${show ? "pr-8" : ""}`}
                  value={ctl.value === "" || ctl.value === undefined || ctl.value === null ? "" : String(ctl.value)}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") ctl.onChange(null);
                    else {
                      const n = Number(v);
                      ctl.onChange(Number.isNaN(n) ? v : n);
                    }
                  }}
                  onBlur={ctl.onBlur}
                  name={ctl.name}
                  ref={ctl.ref}
                />
                {show ? (
                  <InfoFieldPriorChip
                    htmlId={chipHtmlId(`prior-top-${field.id}`)}
                    inputType="number"
                    prior={prior}
                    onUse={() => setValue!(topPath, prior as never, { shouldDirty: true, shouldTouch: true })}
                  />
                ) : null}
              </div>
            );
          }}
        />
      );
    }
    case "date": {
      if (!canPrior) {
        return <input type="date" {...register(topPath, { required: field.required })} className="ui-input" />;
      }
      const prior = priorRaw;
      return (
        <Controller
          name={topPath}
          control={control}
          rules={{ required: field.required ? "Required" : false }}
          render={({ field: ctl }) => {
            const show =
              priorPresentForTop(prior, "date") && !topFieldValuesMatch(ctl.value, prior, "date");
            return (
              <div className={`group/info relative ${show ? "pt-1" : ""}`}>
                <input
                  type="date"
                  autoComplete="off"
                  className={`ui-input ${show ? "pr-8" : ""}`}
                  value={ctl.value == null ? "" : String(ctl.value)}
                  onChange={(e) => ctl.onChange(e.target.value || null)}
                  onBlur={ctl.onBlur}
                  name={ctl.name}
                  ref={ctl.ref}
                />
                {show ? (
                  <InfoFieldPriorChip
                    htmlId={chipHtmlId(`prior-top-${field.id}`)}
                    inputType="date"
                    prior={prior}
                    onUse={() => setValue!(topPath, prior as never, { shouldDirty: true, shouldTouch: true })}
                  />
                ) : null}
              </div>
            );
          }}
        />
      );
    }
    case "toggle": {
      if (!canPrior) {
        return <input type="checkbox" {...register(topPath)} className="mt-2 h-4 w-4" />;
      }
      const prior = priorRaw;
      return (
        <Controller
          name={topPath}
          control={control}
          render={({ field: ctl }) => {
            const show =
              priorPresentForTop(prior, "toggle") && !topFieldValuesMatch(ctl.value, prior, "toggle");
            return (
              <div className="group/info relative min-h-7 overflow-visible pt-0.5">
                <input
                  type="checkbox"
                  className="relative z-0 mt-2 h-4 w-4"
                  checked={Boolean(ctl.value)}
                  onChange={(e) => ctl.onChange(e.target.checked)}
                  onBlur={ctl.onBlur}
                  name={ctl.name}
                  ref={ctl.ref}
                />
                {show ? (
                  <InfoFieldPriorChip
                    htmlId={chipHtmlId(`prior-top-${field.id}`)}
                    inputType="toggle"
                    prior={prior}
                    onUse={() =>
                      setValue!(topPath, (typeof prior === "boolean" ? prior : Boolean(prior)) as never, {
                        shouldDirty: true,
                        shouldTouch: true,
                      })
                    }
                  />
                ) : null}
              </div>
            );
          }}
        />
      );
    }
    case "select": {
      const opts = field.options ?? [];
      const useButtons = opts.length > 0 && opts.length < 4;
      if (useButtons) {
        if (!canPrior) {
          return (
            <Controller
              name={topPath}
              control={control}
              rules={{ required: field.required ? "Required" : false }}
              render={({ field: ctl }) => (
                <div className="mt-2 flex flex-wrap gap-2">
                  {opts.map((o) => {
                    const selected = String(ctl.value ?? "") === o.value;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        className={
                          selected
                            ? "rounded-xl border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm"
                            : "rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:border-zinc-300"
                        }
                        onClick={() => ctl.onChange(o.value)}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              )}
            />
          );
        }
        const prior = priorRaw;
        return (
          <Controller
            name={topPath}
            control={control}
            rules={{ required: field.required ? "Required" : false }}
            render={({ field: ctl }) => {
              const show =
                priorPresentForTop(prior, "select") && !topFieldValuesMatch(ctl.value, prior, "select");
              return (
                <div className="group/info relative">
                  <div className="mt-2 flex flex-wrap gap-2">
                    {opts.map((o) => {
                      const selected = String(ctl.value ?? "") === o.value;
                      return (
                        <button
                          key={o.id}
                          type="button"
                          className={
                            selected
                              ? "rounded-xl border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm"
                              : "rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:border-zinc-300"
                          }
                          onClick={() => ctl.onChange(o.value)}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                  {show ? (
                    <InfoFieldPriorChip
                      htmlId={chipHtmlId(`prior-top-${field.id}`)}
                      inputType="select"
                      prior={prior}
                      onUse={() => setValue!(topPath, prior as never, { shouldDirty: true, shouldTouch: true })}
                    />
                  ) : null}
                </div>
              );
            }}
          />
        );
      }
      if (!canPrior) {
        return (
          <select {...register(topPath, { required: field.required })} className="ui-input">
            {!field.required ? <option value="">—</option> : null}
            {opts.length === 0 ? (
              <option value="" disabled>
                No options configured
              </option>
            ) : (
              opts.map((o) => (
                <option key={o.id} value={o.value}>
                  {o.label}
                </option>
              ))
            )}
          </select>
        );
      }
      const prior = priorRaw;
      return (
        <Controller
          name={topPath}
          control={control}
          rules={{ required: field.required ? "Required" : false }}
          render={({ field: ctl }) => {
            const show =
              priorPresentForTop(prior, "select") && !topFieldValuesMatch(ctl.value, prior, "select");
            return (
              <div className={`group/info relative ${show ? "pt-1" : ""}`}>
                <select
                  className={`ui-input ${show ? "pr-8" : ""}`}
                  value={ctl.value == null ? "" : String(ctl.value)}
                  onChange={(e) => ctl.onChange(e.target.value)}
                  onBlur={ctl.onBlur}
                  name={ctl.name}
                  ref={ctl.ref}
                  autoComplete="off"
                >
                  {!field.required ? <option value="">—</option> : null}
                  {opts.length === 0 ? (
                    <option value="" disabled>
                      No options configured
                    </option>
                  ) : (
                    opts.map((o) => (
                      <option key={o.id} value={o.value}>
                        {o.label}
                      </option>
                    ))
                  )}
                </select>
                {show ? (
                  <InfoFieldPriorChip
                    htmlId={chipHtmlId(`prior-top-${field.id}`)}
                    inputType="select"
                    prior={prior}
                    onUse={() => setValue!(topPath, prior as never, { shouldDirty: true, shouldTouch: true })}
                  />
                ) : null}
              </div>
            );
          }}
        />
      );
    }
    default: {
      if (!canPrior) {
        return <input type="text" {...register(topPath, { required: field.required })} className="ui-input" />;
      }
      const prior = priorRaw;
      return (
        <Controller
          name={topPath}
          control={control}
          rules={{ required: field.required ? "Required" : false }}
          render={({ field: ctl }) => {
            const show =
              priorPresentForTop(prior, "text") && !topFieldValuesMatch(ctl.value, prior, "text");
            return (
              <div className={`group/info relative ${show ? "pt-1" : ""}`}>
                <input
                  type="text"
                  autoComplete="off"
                  className={`ui-input ${show ? "pr-8" : ""}`}
                  value={ctl.value == null ? "" : String(ctl.value)}
                  onChange={(e) => ctl.onChange(e.target.value)}
                  onBlur={ctl.onBlur}
                  name={ctl.name}
                  ref={ctl.ref}
                />
                {show ? (
                  <InfoFieldPriorChip
                    htmlId={chipHtmlId(`prior-top-${field.id}`)}
                    inputType="text"
                    prior={prior}
                    onUse={() => setValue!(topPath, prior as never, { shouldDirty: true, shouldTouch: true })}
                  />
                ) : null}
              </div>
            );
          }}
        />
      );
    }
  }
}
