import { controlChartFactors, k1ForTrials, k2ForOperators, k3ForParts } from "./kFactors";

export type GageRrInput = {
  /** operators × parts × trials */
  data: number[][][];
  operators: number;
  parts: number;
  trials: number;
};

export type SubgroupChartPoint = {
  label: string;
  operatorIndex: number;
  partIndex: number;
  xbar: number;
  range: number;
};

export type GageRrResult = {
  ok: true;
  grandMean: number;
  /** Per operator: mean of part ranges (range across trials). */
  meanRangeByOperator: number[];
  rDoubleBar: number;
  operatorMeans: number[];
  operatorMeanRange: number;
  partMeans: number[];
  rangeOfPartMeans: number;
  k1: number;
  k2: number;
  k3: number;
  /** Repeatability — equipment variation */
  ev: number;
  /** Reproducibility — appraiser variation */
  av: number;
  grr: number;
  pv: number;
  tv: number;
  pctEv: number;
  pctAv: number;
  pctGrr: number;
  pctPv: number;
  subgroups: SubgroupChartPoint[];
  /** Average range across all (operator, part) subgroups — for control limits */
  meanSubgroupRange: number;
  chartFactors: { a2: number; d3: number; d4: number };
  uclXbar: number;
  lclXbar: number;
  uclR: number;
  lclR: number;
};

export type GageRrError = { ok: false; message: string };

function allFinite(data: number[][][], o: number, p: number, t: number): boolean {
  for (let i = 0; i < o; i++) {
    for (let j = 0; j < p; j++) {
      for (let k = 0; k < t; k++) {
        const v = data[i]?.[j]?.[k];
        if (v == null || !Number.isFinite(v)) return false;
      }
    }
  }
  return true;
}

/**
 * Crossed Gage R&R — Average & Range method (AIAG / typical Excel template).
 *
 * - EV = R̄̄ × K₁  (K₁ from # trials)
 * - AV = √ max(0 , (X̄_diff × K₂)² − EV² / (n_parts × n_trials) )  (K₂ from # operators)
 * - GRR = √(EV² + AV²)
 * - PV = R_p × K₃  (range of part means, K₃ from # parts)
 * - TV = √(GRR² + PV²)
 */
export function computeGageRr(input: GageRrInput): GageRrResult | GageRrError {
  const { data, operators: O, parts: P, trials: R } = input;
  if (O < 2 || P < 2 || R < 2) {
    return { ok: false, message: "Need at least 2 operators, 2 parts, and 2 trials." };
  }
  if (!allFinite(data, O, P, R)) {
    return { ok: false, message: "Fill all cells with valid numbers." };
  }

  const k1 = k1ForTrials(R);
  const k2 = k2ForOperators(O);
  const k3 = k3ForParts(P);
  if (k1 == null || k2 == null || k3 == null) {
    return {
      ok: false,
      message: "Unsupported dimensions: trials 2–10, operators 2–20, parts 2–20.",
    };
  }

  const subgroups: SubgroupChartPoint[] = [];
  let sumAll = 0;
  let countAll = 0;

  const meanRangeByOperator: number[] = [];
  const operatorMeans: number[] = new Array(O).fill(0);
  const operatorCounts: number[] = new Array(O).fill(0);

  for (let o = 0; o < O; o++) {
    let sumRanges = 0;
    for (let p = 0; p < P; p++) {
      const vals = data[o][p];
      const minV = Math.min(...vals);
      const maxV = Math.max(...vals);
      const range = maxV - minV;
      const xbar = vals.reduce((a, b) => a + b, 0) / R;
      sumRanges += range;
      sumAll += vals.reduce((a, b) => a + b, 0);
      countAll += R;
      operatorMeans[o] += vals.reduce((a, b) => a + b, 0);
      operatorCounts[o] += R;
      subgroups.push({
        label: `P${p + 1}·O${o + 1}`,
        operatorIndex: o,
        partIndex: p,
        xbar,
        range,
      });
    }
    meanRangeByOperator[o] = sumRanges / P;
  }

  const grandMean = sumAll / countAll;
  for (let o = 0; o < O; o++) operatorMeans[o] /= operatorCounts[o];

  const rDoubleBar = meanRangeByOperator.reduce((a, b) => a + b, 0) / O;
  const operatorMeanRange = Math.max(...operatorMeans) - Math.min(...operatorMeans);

  const partMeans: number[] = [];
  for (let p = 0; p < P; p++) {
    let s = 0;
    let c = 0;
    for (let o = 0; o < O; o++) {
      for (let t = 0; t < R; t++) {
        s += data[o][p][t];
        c++;
      }
    }
    partMeans.push(s / c);
  }
  const rangeOfPartMeans = Math.max(...partMeans) - Math.min(...partMeans);

  const ev = k1 * rDoubleBar;
  const avInner = (k2 * operatorMeanRange) ** 2 - ev ** 2 / (P * R);
  const av = Math.sqrt(Math.max(0, avInner));
  const grr = Math.sqrt(ev ** 2 + av ** 2);
  const pv = k3 * rangeOfPartMeans;
  const tv = Math.sqrt(grr ** 2 + pv ** 2);

  const pctEv = tv > 0 ? (100 * ev) / tv : 0;
  const pctAv = tv > 0 ? (100 * av) / tv : 0;
  const pctGrr = tv > 0 ? (100 * grr) / tv : 0;
  const pctPv = tv > 0 ? (100 * pv) / tv : 0;

  const meanSubgroupRange =
    subgroups.reduce((acc, s) => acc + s.range, 0) / subgroups.length;
  const cf = controlChartFactors(R);
  if (!cf) {
    return { ok: false, message: "Control chart factors not available for this trial count." };
  }
  const uclXbar = grandMean + cf.a2 * meanSubgroupRange;
  const lclXbar = grandMean - cf.a2 * meanSubgroupRange;
  const uclR = cf.d4 * meanSubgroupRange;
  const lclR = cf.d3 * meanSubgroupRange;

  return {
    ok: true,
    grandMean,
    meanRangeByOperator,
    rDoubleBar,
    operatorMeans,
    operatorMeanRange,
    partMeans,
    rangeOfPartMeans,
    k1,
    k2,
    k3,
    ev,
    av,
    grr,
    pv,
    tv,
    pctEv,
    pctAv,
    pctGrr,
    pctPv,
    subgroups,
    meanSubgroupRange,
    chartFactors: cf,
    uclXbar,
    lclXbar,
    uclR,
    lclR,
  };
}

export function grrTrafficLight(pctGrr: number): "acceptable" | "marginal" | "unacceptable" {
  if (pctGrr < 10) return "acceptable";
  if (pctGrr <= 30) return "marginal";
  return "unacceptable";
}
