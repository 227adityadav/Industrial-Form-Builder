"use client";

import type { InputType } from "@/types/form-schema";

export function priorPresentForTop(raw: unknown, inputType: InputType): boolean {
  if (raw === undefined || raw === null) return false;
  if (typeof raw === "string" && raw.trim() === "") return false;
  return true;
}

export function topFieldValuesMatch(current: unknown, prior: unknown, inputType: InputType): boolean {
  if (inputType === "toggle") return Boolean(current) === Boolean(prior);
  if (current == null && prior == null) return true;
  if (current == null || prior == null) return false;
  if (typeof current === "number" || typeof prior === "number") {
    const nc = Number(current);
    const np = Number(prior);
    return !Number.isNaN(nc) && !Number.isNaN(np) && nc === np;
  }
  return String(current) === String(prior);
}

export function formatInfoPriorChipFace(prior: unknown, inputType: InputType): string {
  if (inputType === "toggle") return prior ? "Yes" : "No";
  if (prior == null) return "";
  if (inputType === "date" && typeof prior === "string") {
    try {
      const d = new Date(prior);
      if (!Number.isNaN(d.getTime())) return d.toLocaleDateString();
    } catch {
      /* fall through */
    }
  }
  const s = String(prior);
  return s.length > 22 ? `${s.slice(0, 20)}…` : s;
}

type InfoFieldPriorChipProps = {
  htmlId: string;
  inputType: InputType;
  prior: unknown;
  onUse: () => void;
};

/** Small chip (same idea as grid {@link DynamicTable} prior popup) for info / top fields. */
export function InfoFieldPriorChip({ htmlId, inputType, prior, onUse }: InfoFieldPriorChipProps) {
  const full =
    inputType === "toggle"
      ? prior
        ? "Previously: checked"
        : "Previously: unchecked"
      : `Previous: ${prior == null ? "" : String(prior)}`;

  return (
    <button
      id={htmlId}
      type="button"
      title={full}
      aria-label={`Use previous value: ${full}`}
      className="pointer-events-auto absolute -top-0.5 right-0 z-20 hidden max-w-[min(11rem,calc(100%-0.25rem))] truncate rounded-md border border-emerald-600/35 bg-white px-1.5 py-0.5 text-left text-[11px] font-semibold leading-tight text-emerald-900 shadow-md ring-1 ring-emerald-600/15 transition hover:bg-emerald-50 group-focus-within/info:block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-600/50"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onUse();
      }}
    >
      {formatInfoPriorChipFace(prior, inputType)}
    </button>
  );
}
