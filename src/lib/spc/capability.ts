/**
 * X̄–R process capability (short-term σ from average range / d₂).
 * d₂ constants: Montgomery, Introduction to Statistical Quality Control.
 */

export const D2_BY_SUBGROUP_SIZE: Record<number, number> = {
  2: 1.128,
  3: 1.693,
  4: 2.059,
  5: 2.326,
  6: 2.534,
  7: 2.704,
  8: 2.847,
  9: 2.97,
  10: 3.078,
  11: 3.173,
  12: 3.258,
  13: 3.336,
  14: 3.407,
  15: 3.472,
  16: 3.532,
  17: 3.588,
  18: 3.64,
  19: 3.689,
  20: 3.735,
  21: 3.778,
  22: 3.819,
  23: 3.858,
  24: 3.895,
  25: 3.931,
};

export function getD2(subgroupSize: number): number | null {
  return D2_BY_SUBGROUP_SIZE[subgroupSize] ?? null;
}

export function parseMeasurementCell(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export type SubgroupSummary = {
  index: number;
  values: number[];
  mean: number;
  range: number;
};

export type CapabilityResult = {
  subgroups: SubgroupSummary[];
  grandMean: number;
  averageRange: number;
  d2: number;
  sigma: number;
  cp: number;
  cpk: number;
  cpu: number;
  cpl: number;
};

export type CapabilityComputeStatus =
  | { ok: false; reason: string }
  | { ok: true; result: CapabilityResult };

export function summarizeSubgroups(
  cells: string[][],
  subgroupSize: number
): { complete: SubgroupSummary[]; incompleteRows: number[] } {
  const complete: SubgroupSummary[] = [];
  const incompleteRows: number[] = [];
  cells.forEach((row, idx) => {
    const nums: number[] = [];
    let bad = false;
    for (let c = 0; c < subgroupSize; c++) {
      const v = parseMeasurementCell(row[c] ?? "");
      if (v === null) {
        bad = true;
        break;
      }
      nums.push(v);
    }
    if (bad || nums.length !== subgroupSize) {
      incompleteRows.push(idx + 1);
      return;
    }
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
    const range = Math.max(...nums) - Math.min(...nums);
    complete.push({ index: idx + 1, values: nums, mean, range });
  });
  return { complete, incompleteRows };
}

export function computeCapability(
  cells: string[][],
  subgroupSize: number,
  usl: number,
  lsl: number
): CapabilityComputeStatus {
  if (!(Number.isFinite(usl) && Number.isFinite(lsl)) || usl <= lsl) {
    return { ok: false, reason: "Enter valid upper and lower specification limits (USL > LSL)." };
  }
  const d2 = getD2(subgroupSize);
  if (d2 == null) {
    return {
      ok: false,
      reason: "Subgroup size must be between 2 and 25 (d₂ table) for this σ estimate.",
    };
  }
  const { complete } = summarizeSubgroups(cells, subgroupSize);
  if (complete.length === 0) {
    return { ok: false, reason: "Enter a full set of measurements for at least one subgroup." };
  }
  const k = complete.length;
  const grandMean = complete.reduce((s, g) => s + g.mean, 0) / k;
  const averageRange = complete.reduce((s, g) => s + g.range, 0) / k;
  const sigma = averageRange / d2;
  if (!(sigma > 0)) {
    return { ok: false, reason: "Estimated σ is zero (no variation within subgroups)." };
  }
  const cp = (usl - lsl) / (6 * sigma);
  const cpu = (usl - grandMean) / (3 * sigma);
  const cpl = (grandMean - lsl) / (3 * sigma);
  const cpk = Math.min(cpu, cpl);
  return {
    ok: true,
    result: {
      subgroups: complete,
      grandMean,
      averageRange,
      d2,
      sigma,
      cp,
      cpk,
      cpu,
      cpl,
    },
  };
}

export function formatCapability(n: number, digits = 4): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}
