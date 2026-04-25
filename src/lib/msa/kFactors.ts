/**
 * AIAG MSA Manual (Average & Range method) — d₂-derived constants.
 * K₁ = 1/d₂* for trials, K₂/K₃ = 1/d₂* for number of appraisers / parts.
 */

const K1_BY_TRIALS: Record<number, number> = {
  2: 4.45,
  3: 3.05,
  4: 2.5,
  5: 2.21,
  6: 2.03,
  7: 1.92,
  8: 1.86,
  9: 1.82,
  10: 1.78,
};

/** Same d₂* family as parts / appraisers for crossed GR&R (AIAG tables). */
const K23_BY_COUNT: Record<number, number> = {
  2: 3.65,
  3: 2.7,
  4: 2.3,
  5: 2.0,
  6: 1.93,
  7: 1.87,
  8: 1.82,
  9: 1.78,
  10: 1.74,
  11: 1.71,
  12: 1.69,
  13: 1.67,
  14: 1.65,
  15: 1.64,
  16: 1.63,
  17: 1.62,
  18: 1.61,
  19: 1.6,
  20: 1.59,
};

export function k1ForTrials(trials: number): number | null {
  if (trials < 2 || trials > 10) return null;
  return K1_BY_TRIALS[trials] ?? null;
}

export function k2ForOperators(operators: number): number | null {
  if (operators < 2 || operators > 20) return null;
  return K23_BY_COUNT[operators] ?? null;
}

export function k3ForParts(parts: number): number | null {
  if (parts < 2 || parts > 20) return null;
  return K23_BY_COUNT[parts] ?? null;
}

/** X̄–R control chart factors (subgroup size = trials). */
export function controlChartFactors(subgroupSize: number): {
  a2: number;
  d3: number;
  d4: number;
} | null {
  const table: Record<number, { a2: number; d3: number; d4: number }> = {
    2: { a2: 1.88, d3: 0, d4: 3.267 },
    3: { a2: 1.023, d3: 0, d4: 2.574 },
    4: { a2: 0.729, d3: 0, d4: 2.282 },
    5: { a2: 0.577, d3: 0, d4: 2.114 },
    6: { a2: 0.483, d3: 0, d4: 2.004 },
    7: { a2: 0.419, d3: 0.076, d4: 1.924 },
    8: { a2: 0.373, d3: 0.136, d4: 1.864 },
    9: { a2: 0.337, d3: 0.184, d4: 1.816 },
    10: { a2: 0.308, d3: 0.223, d4: 1.777 },
  };
  return table[subgroupSize] ?? null;
}
