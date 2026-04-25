const KEY = "industrial-form-builder:msa:v1";

export type MsaSavedStudy = {
  version: 1;
  savedAt: string;
  studyName: string;
  operators: number;
  parts: number;
  trials: number;
  /** string cells for variable grid — parsed as numbers on load */
  cells: string[][][];
  tolerance: string;
  attributeRows?: { part: string; appraiser1: string; appraiser2: string; reference: string }[];
};

export function loadMsaStudy(): MsaSavedStudy | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as MsaSavedStudy;
    if (v?.version !== 1) return null;
    return v;
  } catch {
    return null;
  }
}

export function saveMsaStudy(study: MsaSavedStudy): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(study));
}

export function clearMsaStudy(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
