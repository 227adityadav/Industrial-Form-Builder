import type { CapabilityResult, SubgroupSummary } from "./capability";

export type XbarPoint = {
  sg: number;
  xbar: number;
  ucl: number;
  lcl: number;
  cl: number;
};

export type RPoint = {
  sg: number;
  r: number;
  ucl: number;
  lcl: number;
  cl: number;
};

export function buildXbarRChartData(
  result: CapabilityResult,
  a2: number,
  d3: number,
  d4: number
): { xbar: XbarPoint[]; r: RPoint[] } {
  const { subgroups, grandMean, averageRange: rBar } = result;
  const uclX = grandMean + a2 * rBar;
  const lclX = grandMean - a2 * rBar;
  const uclR = d4 * rBar;
  const lclR = d3 * rBar;
  const xbar: XbarPoint[] = subgroups.map((s) => ({
    sg: s.index,
    xbar: s.mean,
    ucl: uclX,
    lcl: lclX,
    cl: grandMean,
  }));
  const r: RPoint[] = subgroups.map((s) => ({
    sg: s.index,
    r: s.range,
    ucl: uclR,
    lcl: lclR,
    cl: rBar,
  }));
  return { xbar, r };
}

export type RollingCapPoint = {
  k: number;
  cp: number;
  cpk: number;
  cpu: number;
  cpl: number;
};

/**
 * Cumulative (running) Cp / Cpk / Cpu / Cpl as each additional subgroup is included
 * (short-term σ = R̄ₖ / d₂ over the first k subgroups).
 */
export function rollingCapabilitySeries(
  subgroups: SubgroupSummary[],
  d2: number,
  usl: number,
  lsl: number
): RollingCapPoint[] {
  const out: RollingCapPoint[] = [];
  const n = subgroups.length;
  if (n < 1 || !(d2 > 0) || !(usl > lsl)) return out;
  for (let k = 1; k <= n; k++) {
    const slice = subgroups.slice(0, k);
    const grandMean = slice.reduce((s, g) => s + g.mean, 0) / k;
    const rBar = slice.reduce((s, g) => s + g.range, 0) / k;
    const sigma = rBar / d2;
    if (!(sigma > 0)) continue;
    const cp = (usl - lsl) / (6 * sigma);
    const cpu = (usl - grandMean) / (3 * sigma);
    const cpl = (grandMean - lsl) / (3 * sigma);
    const cpk = Math.min(cpu, cpl);
    out.push({ k, cp, cpk, cpu, cpl });
  }
  return out;
}

/**
 * Pp / Ppk using overall sample s (all individual measurements) vs. short-term Cp / Cpk from R̄/d₂.
 */
export function longTermPpPpk(
  subgroups: SubgroupSummary[],
  usl: number,
  lsl: number
): { pp: number; ppk: number } | null {
  const all = subgroups.flatMap((g) => g.values);
  const n = all.length;
  if (n < 2) return null;
  const mean = all.reduce((a, b) => a + b, 0) / n;
  const s = Math.sqrt(all.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1));
  if (!(s > 0)) return null;
  return {
    pp: (usl - lsl) / (6 * s),
    ppk: Math.min((usl - mean) / (3 * s), (mean - lsl) / (3 * s)),
  };
}

export type HistBin = {
  label: string;
  center: number;
  lo: number;
  hi: number;
  count: number;
  normal: number;
};

/** Standard normal CDF — Abramowitz & Stegun. */
function standardNormalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-0.5 * z * z);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z >= 0 ? 1 - prob : prob;
}

function normalCdfInRange(lo: number, hi: number, mean: number, sd: number): number {
  if (!(sd > 0)) return 0;
  const p1 = standardNormalCdf((lo - mean) / sd);
  const p2 = standardNormalCdf((hi - mean) / sd);
  return Math.max(0, p2 - p1);
}

/**
 * Histogram of all individual measurements in subgroups, with expected counts from N(μ,σ̂) per bin.
 */
export function buildHistogramData(
  subgroups: SubgroupSummary[],
  mean: number,
  sigma: number
): HistBin[] {
  const values = subgroups.flatMap((g) => g.values);
  const m = values.length;
  if (m < 2) return [];
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  if (!(minV < maxV)) {
    const w = Math.abs(mean) * 0.01 + 0.0001;
    return buildHistogramBetween(values, mean - w, mean + w, mean, sigma, 1);
  }
  const span = maxV - minV;
  const nBins = Math.max(5, Math.min(20, Math.round(1 + 3.322 * Math.log10(m))));
  const lo = minV - span * 0.02;
  const hi = maxV + span * 0.02;
  return buildHistogramBetween(values, lo, hi, mean, sigma, nBins);
}

function buildHistogramBetween(
  values: number[],
  lo: number,
  hi: number,
  mean: number,
  sigma: number,
  nBins: number
): HistBin[] {
  const w = (hi - lo) / nBins;
  if (!(w > 0)) return [];
  const m = values.length;
  const bins: HistBin[] = [];
  for (let b = 0; b < nBins; b++) {
    const bLo = lo + b * w;
    const bHi = lo + (b + 1) * w;
    let c = 0;
    for (const v of values) {
      if (v >= bLo && (b === nBins - 1 ? v <= bHi : v < bHi)) c += 1;
    }
    const nApprox = m * normalCdfInRange(bLo, bHi, mean, sigma);
    const center = (bLo + bHi) / 2;
    bins.push({
      label: center.toFixed(3),
      center,
      lo: bLo,
      hi: bHi,
      count: c,
      normal: Math.max(0, nApprox),
    });
  }
  return bins;
}
