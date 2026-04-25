"use client";

import * as React from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CapabilityResult } from "@/lib/spc/capability";
import { getXbarRFactors } from "@/lib/spc/control-limits";
import { buildHistogramData, buildXbarRChartData, rollingCapabilitySeries } from "@/lib/spc/spc-charts-data";
import type { HistBin, RollingCapPoint } from "@/lib/spc/spc-charts-data";

const tipStyle = { background: "#0f172a" as const, border: "1px solid #334155" as const };
const tickStyle = { fill: "#94a3b8", fontSize: 10 };

type Props = {
  result: CapabilityResult;
  subgroupSize: number;
  usl: number;
  lsl: number;
};

function yPad(values: number[], padRatio = 0.06): [string | number, string | number] {
  const m = values.filter((v) => Number.isFinite(v));
  if (m.length < 1) return ["auto", "auto"];
  const a = Math.min(...m);
  const b = Math.max(...m);
  const p = (b - a) * padRatio || 0.001;
  return [a - p, b + p];
}

export function SpcChartsPanel({ result, subgroupSize, usl, lsl }: Props) {
  const xbarR = React.useMemo(() => {
    const f = getXbarRFactors(subgroupSize);
    if (!f) return null;
    return buildXbarRChartData(result, f.a2, f.d3, f.d4);
  }, [result, subgroupSize]);

  const roll = React.useMemo(
    () => rollingCapabilitySeries(result.subgroups, result.d2, usl, lsl),
    [result, usl, lsl]
  );

  const hist = React.useMemo(
    () => buildHistogramData(result.subgroups, result.grandMean, result.sigma),
    [result]
  );

  if (!xbarR) {
    return (
      <section className="space-y-6 rounded-xl border border-slate-700/80 bg-slate-900/50 p-5 ring-1 ring-white/5">
        <p className="text-sm text-amber-100/90">A2/D3/D4 are not in table for this subgroup size. X̄ and R control charts are unavailable.</p>
        <HistogramAndCapSections hist={hist} roll={roll} usl={usl} lsl={lsl} />
      </section>
    );
  }

  const xb = xbarR.xbar[0];
  const xDomain = yPad(xbarR.xbar.flatMap((d) => [d.xbar, d.ucl, d.lcl, d.cl]));
  const rDomain = yPad(xbarR.r.flatMap((d) => [d.r, d.ucl, d.lcl, d.cl]));

  return (
    <section className="space-y-6 rounded-xl border border-slate-700/80 bg-slate-900/50 p-5 ring-1 ring-white/5">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">SPC charts</h2>
        <p className="mt-1 text-sm text-slate-500">
          X̄ and R (3σ) · histogram vs. fitted normal (μ = X̄̄, σ̂ = R̄/d₂) · running Cp, Cpk, Cpu, and Cpl
        </p>
      </div>

      <div className="h-72 w-full min-h-[288px] min-w-0">
        <p className="mb-2 text-xs font-medium text-slate-400">X̄ chart (subgroup means)</p>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={xbarR.xbar} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="sg" tick={tickStyle} />
            <YAxis tick={tickStyle} domain={xDomain} />
            <Tooltip
              contentStyle={tipStyle}
              labelFormatter={(k) => `Subgroup ${k}`}
            />
            <Legend />
            {xb ? (
              <>
                <ReferenceLine y={xb.cl} stroke="#34d399" strokeDasharray="4 4" name="X̄̄" />
                <ReferenceLine y={xb.ucl} stroke="#fbbf24" strokeDasharray="3 3" />
                <ReferenceLine y={xb.lcl} stroke="#fbbf24" strokeDasharray="3 3" />
              </>
            ) : null}
            <Line
              type="monotone"
              dataKey="xbar"
              name="X̄"
              stroke="#38bdf8"
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="h-72 w-full min-h-[288px] min-w-0">
        <p className="mb-2 text-xs font-medium text-slate-400">R chart (within-subgroup range)</p>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={xbarR.r} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="sg" tick={tickStyle} />
            <YAxis tick={tickStyle} domain={rDomain} />
            <Tooltip contentStyle={tipStyle} labelFormatter={(k) => `Subgroup ${k}`} />
            <Legend />
            {xbarR.r[0] ? (
              <>
                <ReferenceLine y={xbarR.r[0].cl} stroke="#34d399" strokeDasharray="4 4" />
                <ReferenceLine y={xbarR.r[0].ucl} stroke="#f87171" strokeDasharray="3 3" />
                <ReferenceLine y={xbarR.r[0].lcl} stroke="#f87171" strokeDasharray="3 3" />
              </>
            ) : null}
            <Line
              type="monotone"
              dataKey="r"
              name="R"
              stroke="#a78bfa"
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <HistogramAndCapSections hist={hist} roll={roll} usl={usl} lsl={lsl} />
    </section>
  );
}

function HistogramAndCapSections({
  hist,
  roll,
  usl,
  lsl,
}: {
  hist: HistBin[];
  roll: RollingCapPoint[];
  usl: number;
  lsl: number;
}) {
  const hDomain = React.useMemo(
    () => (hist.length ? yPad(hist.flatMap((b) => [b.lo, b.hi, b.center, usl, lsl])) : ["auto", "auto"]),
    [hist, usl, lsl]
  );

  return (
    <>
      {hist.length > 0 ? (
        <div className="h-80 w-full min-h-[320px] min-w-0">
          <p className="mb-2 text-xs font-medium text-slate-400">Histogram &amp; process distribution (Normal, short-term σ̂)</p>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={hist} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="center"
                type="number"
                domain={hDomain}
                tick={tickStyle}
                allowDecimals
              />
              <YAxis tick={tickStyle} allowDecimals />
              <Tooltip
                contentStyle={tipStyle}
                formatter={(v, name) => {
                  const label = name === "count" ? "Count" : "Expected (N(μ,σ̂), area×n)";
                  return [typeof v === "number" ? v.toFixed(2) : v, label];
                }}
                labelFormatter={(c) => `~${Number(c).toFixed(4)}`}
              />
              <Legend />
              <ReferenceLine
                x={lsl}
                stroke="#f87171"
                strokeWidth={1}
                label={{ value: "LSL", fill: "#f87171", position: "top", fontSize: 10 }}
                ifOverflow="extendDomain"
              />
              <ReferenceLine
                x={usl}
                stroke="#f87171"
                strokeWidth={1}
                label={{ value: "USL", fill: "#f87171", position: "top", fontSize: 10 }}
                ifOverflow="extendDomain"
              />
              <Bar dataKey="count" name="Count" fill="#0ea5e9" fillOpacity={0.65} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Line
                type="monotone"
                dataKey="normal"
                name="Fitted N"
                stroke="#34d399"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {roll.length > 0 ? (
        <div className="h-72 w-full min-h-[288px] min-w-0">
          <p className="mb-2 text-xs font-medium text-slate-400">Cpk trend (cumulative: subgroups 1 through k, σ̂ = R̄ₖ/d₂)</p>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={roll} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="k" tick={tickStyle} allowDecimals={false} />
              <YAxis
                tick={tickStyle}
                domain={yPad(roll.flatMap((d) => [d.cp, d.cpk, d.cpu, d.cpl, 0, 1.33, 1.0]))}
              />
              <Tooltip contentStyle={tipStyle} labelFormatter={(k) => `First ${k} subgroups`} />
              <Legend />
              <ReferenceLine
                y={1.33}
                stroke="#fbbf24"
                strokeDasharray="3 3"
                label={{ value: "1.33", fill: "#fbbf24", fontSize: 9 }}
              />
              <Line type="monotone" dataKey="cp" name="Cp" stroke="#a78bfa" dot={false} strokeWidth={1.5} isAnimationActive={false} />
              <Line type="monotone" dataKey="cpk" name="Cpk" stroke="#34d399" dot={false} strokeWidth={2.5} isAnimationActive={false} />
              <Line type="monotone" dataKey="cpu" name="Cpu" stroke="#94a3b8" dot={false} strokeWidth={1.2} isAnimationActive={false} />
              <Line
                type="monotone"
                dataKey="cpl"
                name="Cpl"
                stroke="#64748b"
                dot={false}
                strokeWidth={1.2}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </>
  );
}
