import type { GageRrResult } from "./gageRr";

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildVariableMsaCsv(params: {
  studyName: string;
  operators: number;
  parts: number;
  trials: number;
  data: number[][][];
  result: GageRrResult;
  tolerance?: number;
  pctTolerance?: number | null;
}): string {
  const lines: string[] = [];
  const { studyName, operators: O, parts: P, trials: R, data, result, tolerance, pctTolerance } =
    params;

  lines.push(csvEscape("MSA Variable Gage R&R"), "");
  lines.push(`Study,${csvEscape(studyName)}`);
  lines.push(`Operators,${O},Parts,${P},Trials,${R}`);
  lines.push("");

  const header = ["Part"];
  for (let o = 0; o < O; o++) {
    for (let t = 0; t < R; t++) {
      header.push(`Op${o + 1} T${t + 1}`);
    }
  }
  lines.push(header.map(csvEscape).join(","));

  for (let p = 0; p < P; p++) {
    const row = [`${p + 1}`];
    for (let o = 0; o < O; o++) {
      for (let t = 0; t < R; t++) {
        row.push(String(data[o][p][t]));
      }
    }
    lines.push(row.join(","));
  }

  lines.push("");
  lines.push("Metric,Value");
  lines.push(`Grand mean,${result.grandMean}`);
  lines.push(`R̄̄ (mean of operator mean ranges),${result.rDoubleBar}`);
  lines.push(`X̄_diff (max op mean − min op mean),${result.operatorMeanRange}`);
  lines.push(`R_p (range of part means),${result.rangeOfPartMeans}`);
  lines.push(`K1,${result.k1}`);
  lines.push(`K2,${result.k2}`);
  lines.push(`K3,${result.k3}`);
  lines.push(`EV,${result.ev}`);
  lines.push(`AV,${result.av}`);
  lines.push(`GRR,${result.grr}`);
  lines.push(`PV,${result.pv}`);
  lines.push(`TV,${result.tv}`);
  lines.push(`%EV,${result.pctEv}`);
  lines.push(`%AV,${result.pctAv}`);
  lines.push(`%GRR,${result.pctGrr}`);
  lines.push(`%PV,${result.pctPv}`);
  if (tolerance != null && Number.isFinite(tolerance) && tolerance > 0 && pctTolerance != null) {
    lines.push(`Tolerance width,${tolerance}`);
    lines.push(`%Tolerance (GRR/Tol),${pctTolerance}`);
  }

  return lines.join("\n");
}
