"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { computeAttributeMsa, type AttributeRating, type AttributeRow } from "@/lib/msa/attributeMsa";
import { buildVariableMsaCsv } from "@/lib/msa/exportMsaCsv";
import { computeGageRr, grrTrafficLight, type GageRrResult } from "@/lib/msa/gageRr";
import { clearMsaStudy, loadMsaStudy, saveMsaStudy, type MsaSavedStudy } from "@/lib/msa/msaStorage";

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function emptyGrid(o: number, p: number, t: number): string[][][] {
  const g: string[][][] = [];
  for (let i = 0; i < o; i++) {
    const op: string[][] = [];
    for (let j = 0; j < p; j++) {
      op.push(Array.from({ length: t }, () => ""));
    }
    g.push(op);
  }
  return g;
}

function resizeGrid(prev: string[][][], o: number, p: number, t: number): string[][][] {
  const next = emptyGrid(o, p, t);
  for (let i = 0; i < o; i++) {
    for (let j = 0; j < p; j++) {
      for (let k = 0; k < t; k++) {
        next[i]![j]![k] = prev[i]?.[j]?.[k] ?? "";
      }
    }
  }
  return next;
}

function parseData(cells: string[][][], o: number, p: number, t: number): number[][][] | null {
  const out: number[][][] = [];
  for (let i = 0; i < o; i++) {
    const op: number[][] = [];
    for (let j = 0; j < p; j++) {
      const row: number[] = [];
      for (let k = 0; k < t; k++) {
        const raw = cells[i]?.[j]?.[k]?.trim() ?? "";
        const n = Number(raw);
        if (!Number.isFinite(n)) return null;
        row.push(n);
      }
      op.push(row);
    }
    out.push(op);
  }
  return out;
}

const auditBtn =
  "rounded-lg border border-slate-600 bg-slate-800/90 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 shadow-sm transition hover:bg-slate-700";
const ghostBtn =
  "rounded-lg border border-transparent px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 underline-offset-4 hover:text-white hover:underline";

function downloadBlob(filename: string, mime: string, data: string) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function fmt(n: number, d = 4) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(d);
}

function exampleGrid(): string[][][] {
  /* 3 operators, 10 parts, 3 trials — synthetic small spread */
  const base = [
    [25.1, 25.0, 25.2],
    [24.9, 25.1, 25.0],
    [25.2, 25.2, 25.1],
    [25.0, 24.9, 25.1],
    [25.1, 25.0, 25.0],
    [24.8, 25.0, 24.9],
    [25.2, 25.1, 25.3],
    [25.0, 25.1, 25.0],
    [25.1, 25.2, 25.0],
    [24.9, 25.0, 25.1],
  ];
  const bump = (row: number[], d: number) => row.map((v) => String((Number(v) + d).toFixed(2)));
  const o1 = base.map((r) => bump(r, 0));
  const o2 = base.map((r) => bump(r, 0.08));
  const o3 = base.map((r) => bump(r, -0.05));
  return [o1, o2, o3].map((op) => op.map((r) => r.map(String)));
}

export function MsaStudyClient() {
  const [chartsReady, setChartsReady] = React.useState(false);
  React.useEffect(() => {
    setChartsReady(true);
  }, []);

  const [mode, setMode] = React.useState<"variable" | "attribute">("variable");
  const [studyName, setStudyName] = React.useState("Crossed GR&R");
  const [operators, setOperators] = React.useState(3);
  const [parts, setParts] = React.useState(10);
  const [trials, setTrials] = React.useState(3);
  const [cells, setCells] = React.useState<string[][][]>(() => emptyGrid(3, 10, 3));
  const [tolerance, setTolerance] = React.useState("");

  const [attrRows, setAttrRows] = React.useState<AttributeRow[]>(() =>
    Array.from({ length: 10 }, (_, i) => ({
      part: `Part ${i + 1}`,
      appraiser1: "" as AttributeRating,
      appraiser2: "" as AttributeRating,
      reference: "" as AttributeRating,
    }))
  );

  const O = clampInt(operators, 2, 5);
  const P = clampInt(parts, 2, 20);
  const R = clampInt(trials, 2, 5);

  React.useEffect(() => {
    setCells((prev) => resizeGrid(prev, O, P, R));
  }, [O, P, R]);

  const parsed = React.useMemo(() => parseData(cells, O, P, R), [cells, O, P, R]);
  const grr = React.useMemo(() => {
    if (!parsed) return { ok: false as const, message: "Enter numeric values in every cell." };
    return computeGageRr({ data: parsed, operators: O, parts: P, trials: R });
  }, [parsed, O, P, R]);

  const result: GageRrResult | null = grr.ok ? grr : null;
  const computeError = grr.ok ? null : grr.message;

  const tolNum = Number(tolerance.trim());
  const tolOk = Number.isFinite(tolNum) && tolNum > 0;
  const pctTol =
    result && tolOk ? (100 * result.grr) / tolNum : null;

  const light = result ? grrTrafficLight(result.pctGrr) : null;

  const xbarChartData = React.useMemo(() => {
    if (!result) return [];
    return result.subgroups.map((s, i) => ({
      i: i + 1,
      name: s.label,
      xbar: s.xbar,
      ucl: result.uclXbar,
      lcl: result.lclXbar,
      cl: result.grandMean,
    }));
  }, [result]);

  const rChartData = React.useMemo(() => {
    if (!result) return [];
    return result.subgroups.map((s, i) => ({
      i: i + 1,
      name: s.label,
      range: s.range,
      ucl: result.uclR,
      lcl: result.lclR,
      cl: result.meanSubgroupRange,
    }));
  }, [result]);

  const barVariation = React.useMemo(() => {
    if (!result) return [];
    return [
      { name: "EV", value: result.ev },
      { name: "AV", value: result.av },
      { name: "PV", value: result.pv },
    ];
  }, [result]);

  function setCell(o: number, p: number, t: number, v: string) {
    setCells((prev) => {
      const next = prev.map((op) => op.map((row) => [...row]));
      if (next[o]?.[p]) next[o]![p]![t] = v;
      return next;
    });
  }

  function onSave() {
    const study: MsaSavedStudy = {
      version: 1,
      savedAt: new Date().toISOString(),
      studyName,
      operators: O,
      parts: P,
      trials: R,
      cells,
      tolerance,
      attributeRows: attrRows.map((r) => ({
        part: r.part,
        appraiser1: r.appraiser1,
        appraiser2: r.appraiser2,
        reference: r.reference ?? "",
      })),
    };
    saveMsaStudy(study);
  }

  function onLoad() {
    const s = loadMsaStudy();
    if (!s) return;
    setStudyName(s.studyName);
    setOperators(clampInt(s.operators, 2, 5));
    setParts(clampInt(s.parts, 2, 20));
    setTrials(clampInt(s.trials, 2, 5));
    setTolerance(s.tolerance ?? "");
    const o = clampInt(s.operators, 2, 5);
    const p = clampInt(s.parts, 2, 20);
    const t = clampInt(s.trials, 2, 5);
    setCells(resizeGrid(s.cells ?? emptyGrid(o, p, t), o, p, t));
    if (s.attributeRows?.length) {
      setAttrRows(
        s.attributeRows.map((r) => ({
          part: r.part,
          appraiser1: (r.appraiser1 as AttributeRating) || "",
          appraiser2: (r.appraiser2 as AttributeRating) || "",
          reference: (r.reference as AttributeRating) || "",
        }))
      );
    }
  }

  function onExportCsv() {
    if (!result || !parsed) return;
    const csv = buildVariableMsaCsv({
      studyName,
      operators: O,
      parts: P,
      trials: R,
      data: parsed,
      result,
      tolerance: tolOk ? tolNum : undefined,
      pctTolerance: pctTol,
    });
    const safe = studyName.replace(/[^\w.-]+/g, "_").slice(0, 40);
    downloadBlob(`MSA-GageRR-${safe}.csv`, "text/csv;charset=utf-8", csv);
  }

  const attrResult = React.useMemo(() => computeAttributeMsa(attrRows), [attrRows]);

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="border-b border-slate-700/80 bg-slate-950/90 shadow-lg shadow-black/20 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400/90">
              Quality · MSA
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">
              Measurement System Analysis
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Crossed Gage R&R (Average &amp; Range, AIAG-style constants). Calculations run entirely in
              the browser — no external services.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={auditBtn} onClick={onSave}>
              Save study
            </button>
            <button type="button" className={auditBtn} onClick={onLoad}>
              Load study
            </button>
            <button
              type="button"
              className={auditBtn}
              onClick={() => {
                clearMsaStudy();
              }}
              title="Clears saved study from this browser"
            >
              Clear saved
            </button>
            <button type="button" className={auditBtn} onClick={onExportCsv} disabled={!result}>
              Export CSV
            </button>
            <Link href="/spc/login" className={ghostBtn}>
              SPC login
            </Link>
            <Link href="/spc" className={ghostBtn}>
              SPC study
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap gap-2 rounded-xl border border-slate-700/80 bg-slate-900/40 p-2 ring-1 ring-white/5">
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              mode === "variable"
                ? "bg-emerald-700 text-white shadow"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
            onClick={() => setMode("variable")}
          >
            Variable GR&amp;R
          </button>
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              mode === "attribute"
                ? "bg-emerald-700 text-white shadow"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
            onClick={() => setMode("attribute")}
          >
            Attribute agreement
          </button>
        </div>

        {mode === "variable" ? (
          <>
            <section className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-5 ring-1 ring-white/5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Input</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                  Study name
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50"
                    value={studyName}
                    onChange={(e) => setStudyName(e.target.value)}
                  />
                </label>
                <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                  Operators (2–5)
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50"
                    type="number"
                    min={2}
                    max={5}
                    value={operators}
                    onChange={(e) => setOperators(clampInt(Number(e.target.value), 2, 5))}
                  />
                </label>
                <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                  Parts (2–20)
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50"
                    type="number"
                    min={2}
                    max={20}
                    value={parts}
                    onChange={(e) => setParts(clampInt(Number(e.target.value), 2, 20))}
                  />
                </label>
                <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                  Trials (2–5)
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50"
                    type="number"
                    min={2}
                    max={5}
                    value={trials}
                    onChange={(e) => setTrials(clampInt(Number(e.target.value), 2, 5))}
                  />
                </label>
                <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 sm:col-span-2">
                  Tolerance width (USL − LSL), optional — for %Tolerance = GRR / Tol × 100
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50"
                    inputMode="decimal"
                    placeholder="e.g. 0.5"
                    value={tolerance}
                    onChange={(e) => setTolerance(e.target.value)}
                  />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={auditBtn}
                  onClick={() => {
                    setOperators(3);
                    setParts(10);
                    setTrials(3);
                    setCells(exampleGrid());
                  }}
                >
                  Load example data
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-5 ring-1 ring-white/5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Measurement grid
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Rows = parts · Column groups = operators · Within each group = trials (T1…T{R})
              </p>
              <div className="mt-4 overflow-x-auto rounded-lg border border-slate-700/90 bg-slate-950/40">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-800/80 text-left text-xs uppercase tracking-wide text-slate-300">
                      <th className="sticky left-0 z-10 bg-slate-800/95 px-3 py-2 font-semibold">Part</th>
                      {Array.from({ length: O }, (_, o) => (
                        <th
                          key={o}
                          colSpan={R}
                          className="border-l border-slate-600 px-2 py-2 text-center font-semibold text-emerald-200/90"
                        >
                          Operator {o + 1}
                        </th>
                      ))}
                    </tr>
                    <tr className="border-b border-slate-700 bg-slate-800/60 text-[10px] uppercase text-slate-400">
                      <th className="sticky left-0 z-10 bg-slate-800/95 px-3 py-1" />
                      {Array.from({ length: O }, (_, o) =>
                        Array.from({ length: R }, (_, t) => (
                          <th key={`${o}-${t}`} className="min-w-[4.5rem] px-1 py-1 font-semibold">
                            T{t + 1}
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: P }, (_, p) => (
                      <tr key={p} className="border-b border-slate-800/90 hover:bg-slate-800/30">
                        <td className="sticky left-0 z-10 bg-slate-950/90 px-3 py-1.5 font-mono text-xs text-slate-400">
                          {p + 1}
                        </td>
                        {Array.from({ length: O }, (_, o) =>
                          Array.from({ length: R }, (_, t) => (
                            <td key={`${o}-${t}`} className="p-0.5">
                              <input
                                className="h-9 w-full min-w-[4rem] rounded border border-slate-700/80 bg-slate-900 px-2 font-mono text-xs text-slate-100 outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30"
                                inputMode="decimal"
                                value={cells[o]?.[p]?.[t] ?? ""}
                                onChange={(e) => setCell(o, p, t, e.target.value)}
                                aria-label={`Operator ${o + 1} part ${p + 1} trial ${t + 1}`}
                              />
                            </td>
                          ))
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-5 ring-1 ring-white/5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Calculation</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                EV = K₁ × R̄̄ (repeatability). AV = √((K₂×X̄_diff)² − EV²/(n×r)) with non-negative root
                (reproducibility). GRR = √(EV²+AV²). PV = K₃×R_p (part means range). TV = √(GRR²+PV²).
                Percent contribution uses each component divided by TV × 100.
              </p>
              {computeError ? (
                <p className="mt-4 rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-100/90">
                  {computeError}
                </p>
              ) : null}
            </section>

            {result ? (
              <section className="grid gap-6 lg:grid-cols-[1fr_280px]">
                <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-5 ring-1 ring-white/5">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Results</h2>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Stat label="Grand mean X̄̄" value={fmt(result.grandMean, 5)} />
                    <Stat label="R̄̄ (avg of op. mean ranges)" value={fmt(result.rDoubleBar, 5)} />
                    <Stat label="X̄_diff" value={fmt(result.operatorMeanRange, 5)} />
                    <Stat label="K₁ (trials)" value={String(result.k1)} />
                    <Stat label="K₂ (operators)" value={String(result.k2)} />
                    <Stat label="K₃ (parts)" value={String(result.k3)} />
                    <Stat label="EV" value={fmt(result.ev)} />
                    <Stat label="AV" value={fmt(result.av)} />
                    <Stat label="GRR" value={fmt(result.grr)} highlight />
                    <Stat label="PV" value={fmt(result.pv)} />
                    <Stat label="TV" value={fmt(result.tv)} />
                    <Stat label="%GRR" value={`${fmt(result.pctGrr, 2)} %`} large />
                    <Stat label="%EV" value={`${fmt(result.pctEv, 2)} %`} />
                    <Stat label="%AV" value={`${fmt(result.pctAv, 2)} %`} />
                    <Stat label="%PV" value={`${fmt(result.pctPv, 2)} %`} />
                    {pctTol != null ? (
                      <Stat label="%Tolerance (GRR/Tol)" value={`${fmt(pctTol, 2)} %`} />
                    ) : null}
                  </dl>
                </div>
                <div
                  className={`flex flex-col justify-center rounded-xl border p-6 shadow-lg ring-1 ${
                    light === "acceptable"
                      ? "border-emerald-700/60 bg-emerald-950/30 ring-emerald-500/20"
                      : light === "marginal"
                        ? "border-amber-700/60 bg-amber-950/30 ring-amber-500/20"
                        : "border-red-700/60 bg-red-950/40 ring-red-500/20"
                  }`}
                >
                  <p className="text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                    %GRR vs total variation
                  </p>
                  <p className="mt-2 text-center font-mono text-4xl font-bold text-white">
                    {fmt(result.pctGrr, 1)}%
                  </p>
                  <p className="mt-3 text-center text-sm font-medium text-slate-200">
                    {light === "acceptable"
                      ? "Acceptable — under 10%"
                      : light === "marginal"
                        ? "Marginal — 10% to 30%"
                        : "Not acceptable — over 30%"}
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    <span className="h-3 w-16 rounded-full bg-emerald-500/90" title="&lt;10%" />
                    <span className="h-3 w-16 rounded-full bg-amber-500/90" title="10–30%" />
                    <span className="h-3 w-16 rounded-full bg-red-500/90" title="&gt;30%" />
                  </div>
                </div>
              </section>
            ) : null}

            {result && chartsReady ? (
              <section className="space-y-6 rounded-xl border border-slate-700/80 bg-slate-900/50 p-5 ring-1 ring-white/5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Charts</h2>
                <div className="grid gap-8 lg:grid-cols-1">
                  <div className="h-72 w-full min-h-[288px] min-w-0">
                    <p className="mb-2 text-xs font-medium text-slate-400">X̄ chart (subgroup = part × operator)</p>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={xbarChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="i" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                        <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} domain={["auto", "auto"]} />
                        <Tooltip
                          contentStyle={{ background: "#0f172a", border: "1px solid #334155" }}
                          labelFormatter={(_, p) => (p[0]?.payload?.name as string) ?? ""}
                        />
                        <Legend />
                        <ReferenceLine y={result.grandMean} stroke="#34d399" strokeDasharray="4 4" label="CL" />
                        <ReferenceLine y={result.uclXbar} stroke="#fbbf24" strokeDasharray="3 3" />
                        <ReferenceLine y={result.lclXbar} stroke="#fbbf24" strokeDasharray="3 3" />
                        <Line type="monotone" dataKey="xbar" name="X̄" stroke="#38bdf8" dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-72 w-full min-h-[288px] min-w-0">
                    <p className="mb-2 text-xs font-medium text-slate-400">R chart</p>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={rChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="i" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                        <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} domain={[0, "auto"]} />
                        <Tooltip
                          contentStyle={{ background: "#0f172a", border: "1px solid #334155" }}
                          labelFormatter={(_, p) => (p[0]?.payload?.name as string) ?? ""}
                        />
                        <Legend />
                        <ReferenceLine y={result.meanSubgroupRange} stroke="#34d399" strokeDasharray="4 4" />
                        <ReferenceLine y={result.uclR} stroke="#f87171" strokeDasharray="3 3" />
                        <ReferenceLine y={result.lclR} stroke="#f87171" strokeDasharray="3 3" />
                        <Line type="monotone" dataKey="range" name="R" stroke="#a78bfa" dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-64 w-full min-h-[256px] min-w-0">
                    <p className="mb-2 text-xs font-medium text-slate-400">Components of variation</p>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barVariation} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                        <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                        <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>
            ) : result && !chartsReady ? (
              <section className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-5 text-sm text-slate-400 ring-1 ring-white/5">
                Loading charts…
              </section>
            ) : null}
          </>
        ) : (
          <section className="space-y-4 rounded-xl border border-slate-700/80 bg-slate-900/50 p-5 ring-1 ring-white/5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Attribute study (two appraisers)
            </h2>
            <p className="text-sm text-slate-400">
              Enter P (pass) or F (fail). Optional reference column for effectiveness vs standard. Cohen κ
              uses paired ratings where both appraisers coded.
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-700/90">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800/80 text-left text-xs uppercase text-slate-300">
                    <th className="px-3 py-2">Part</th>
                    <th className="px-3 py-2">Appraiser 1</th>
                    <th className="px-3 py-2">Appraiser 2</th>
                    <th className="px-3 py-2">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {attrRows.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-800">
                      <td className="p-1">
                        <input
                          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                          value={row.part}
                          onChange={(e) => {
                            const v = e.target.value;
                            setAttrRows((prev) => prev.map((r, i) => (i === idx ? { ...r, part: v } : r)));
                          }}
                        />
                      </td>
                      {(["appraiser1", "appraiser2", "reference"] as const).map((field) => (
                        <td key={field} className="p-1">
                          <select
                            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                            value={row[field]}
                            onChange={(e) => {
                              const v = e.target.value as AttributeRating;
                              setAttrRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, [field]: v } : r))
                              );
                            }}
                          >
                            <option value="">—</option>
                            <option value="P">P</option>
                            <option value="F">F</option>
                          </select>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={auditBtn}
                onClick={() =>
                  setAttrRows((prev) => [
                    ...prev,
                    { part: `Part ${prev.length + 1}`, appraiser1: "", appraiser2: "", reference: "" },
                  ])
                }
              >
                Add row
              </button>
              <button
                type="button"
                className={auditBtn}
                onClick={() => setAttrRows((prev) => (prev.length > 2 ? prev.slice(0, -1) : prev))}
              >
                Remove last row
              </button>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-300">
              <p>
                Agreement (A1 vs A2):{" "}
                <span className="font-mono font-semibold text-emerald-300">
                  {fmt(attrResult.pctAgreement12, 1)}%
                </span>{" "}
                ({attrResult.agreement12} of pairs with both ratings)
              </p>
              <p className="mt-2">
                Cohen κ (A1 vs A2):{" "}
                <span className="font-mono font-semibold text-sky-300">
                  {attrResult.kappa12 != null ? fmt(attrResult.kappa12, 3) : "—"}
                </span>
              </p>
              {attrResult.pctAgreement1Ref != null ? (
                <p className="mt-2">
                  A1 vs reference:{" "}
                  <span className="font-mono text-emerald-300">{fmt(attrResult.pctAgreement1Ref, 1)}%</span>
                </p>
              ) : null}
              {attrResult.pctAgreement2Ref != null ? (
                <p className="mt-2">
                  A2 vs reference:{" "}
                  <span className="font-mono text-emerald-300">{fmt(attrResult.pctAgreement2Ref, 1)}%</span>
                </p>
              ) : null}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  large,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  large?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-700/80 bg-slate-950/40 px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd
        className={`mt-0.5 font-mono text-slate-100 ${large ? "text-xl font-bold" : "text-sm"} ${
          highlight ? "text-emerald-300" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
