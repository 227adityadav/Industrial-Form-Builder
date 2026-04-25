"use client";

import * as React from "react";
import { SpcChartsPanel } from "@/components/spc/SpcChartsPanel";
import {
  computeCapability,
  formatCapability,
  summarizeSubgroups,
} from "@/lib/spc/capability";
import { buildSpcStudyCsv, buildSpcStudyPdf } from "@/lib/spc/export-audit";
import { longTermPpPpk } from "@/lib/spc/spc-charts-data";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function resizeGrid(prev: string[][], rows: number, cols: number): string[][] {
  const next: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(prev[r]?.[c] ?? "");
    }
    next.push(row);
  }
  return next;
}

/** Deterministic 25.0 mm demo: in-spec, mild drift, visible X̄–R and capability behaviour. */
function buildExampleSpcGrid(rows: number, cols: number): string[][] {
  const g: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const subCenter = 25.0 + 0.05 * Math.sin((r + 1) * 0.28);
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      const within = (c - (cols - 1) / 2) * 0.012;
      const pat = 0.004 * (((r + 1) * 13 + (c + 1) * 7) % 11);
      const v = subCenter + within + pat;
      row.push(v.toFixed(3));
    }
    g.push(row);
  }
  return g;
}

export function SpcStudyClient() {
  const [chartsReady, setChartsReady] = React.useState(false);
  React.useEffect(() => {
    setChartsReady(true);
  }, []);

  const [partName, setPartName] = React.useState("");
  const [partNo, setPartNo] = React.useState("");
  const [operation, setOperation] = React.useState("");
  const [machineNo, setMachineNo] = React.useState("");
  const [dateStr, setDateStr] = React.useState(todayIsoDate);
  const [instrumentName, setInstrumentName] = React.useState("");
  const [target, setTarget] = React.useState("");
  const [usl, setUsl] = React.useState("");
  const [lsl, setLsl] = React.useState("");

  const [numSubgroups, setNumSubgroups] = React.useState(25);
  const [subgroupSize, setSubgroupSize] = React.useState(5);
  const [cells, setCells] = React.useState<string[][]>(() => resizeGrid([], 25, 5));

  React.useEffect(() => {
    const rows = clampInt(numSubgroups, 1, 100);
    const cols = clampInt(subgroupSize, 2, 25);
    setCells((prev) => resizeGrid(prev, rows, cols));
  }, [numSubgroups, subgroupSize]);

  const uslNum = Number(usl.trim());
  const lslNum = Number(lsl.trim());
  const limitsOk = Number.isFinite(uslNum) && Number.isFinite(lslNum) && uslNum > lslNum;

  const cap = React.useMemo(() => {
    if (!limitsOk) return { ok: false as const, reason: "Enter numeric USL and LSL with USL > LSL." };
    return computeCapability(cells, clampInt(subgroupSize, 2, 25), uslNum, lslNum);
  }, [cells, limitsOk, lslNum, subgroupSize, uslNum]);

  const { complete: completeSubgroups } = React.useMemo(
    () => summarizeSubgroups(cells, clampInt(subgroupSize, 2, 25)),
    [cells, subgroupSize]
  );

  const result = cap.ok ? cap.result : null;
  const computeError = cap.ok ? null : cap.reason;

  const longTerm = React.useMemo(
    () => (result && limitsOk ? longTermPpPpk(result.subgroups, uslNum, lslNum) : null),
    [result, limitsOk, lslNum, uslNum]
  );

  const cpkDisplay = result ? formatCapability(result.cpk, 4) : "—";
  const cpkLow = result != null && result.cpk < 1.33;

  const header = React.useMemo(
    () => ({
      partName,
      partNo,
      operation,
      machineNo,
      date: dateStr,
      instrumentName,
      target,
      upperTolerance: usl,
      lowerTolerance: lsl,
    }),
    [dateStr, instrumentName, lsl, machineNo, operation, partName, partNo, target, usl]
  );

  function downloadBlob(filename: string, mime: string, data: Uint8Array | string) {
    const blob =
      typeof data === "string"
        ? new Blob([data], { type: mime })
        : new Blob([data as BlobPart], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onExportCsv() {
    const csv = buildSpcStudyCsv({
      header,
      numSubgroups: clampInt(numSubgroups, 1, 100),
      subgroupSize: clampInt(subgroupSize, 2, 25),
      cells,
      result,
      computeError,
    });
    const safe = (partNo || partName || "spc-study").replace(/[^\w.-]+/g, "_").slice(0, 40);
    downloadBlob(`SPC-capability-${safe}.csv`, "text/csv;charset=utf-8", csv);
  }

  function onExportPdf() {
    const bytes = buildSpcStudyPdf({
      header,
      numSubgroups: clampInt(numSubgroups, 1, 100),
      subgroupSize: clampInt(subgroupSize, 2, 25),
      cells,
      result,
      computeError,
    });
    const safe = (partNo || partName || "spc-study").replace(/[^\w.-]+/g, "_").slice(0, 40);
    downloadBlob(`SPC-capability-${safe}.pdf`, "application/pdf", bytes);
  }

  function setCell(r: number, c: number, v: string) {
    setCells((prev) => {
      const next = prev.map((row) => [...row]);
      if (!next[r]) return prev;
      const row = [...next[r]!];
      row[c] = v;
      next[r] = row;
      return next;
    });
  }

  function onLoadExample() {
    const nSub = 25;
    const nIn = 5;
    setPartName("Demo bracket (example)");
    setPartNo("DEMO-25x5");
    setOperation("CNC turn");
    setMachineNo("CNC-12");
    setDateStr(todayIsoDate());
    setInstrumentName("0–1 in micrometer (example)");
    setTarget("25.00");
    setUsl("25.10");
    setLsl("24.90");
    setNumSubgroups(nSub);
    setSubgroupSize(nIn);
    setCells(buildExampleSpcGrid(nSub, nIn));
  }

  const rows = clampInt(numSubgroups, 1, 100);
  const cols = clampInt(subgroupSize, 2, 25);

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="border-b border-slate-700/80 bg-slate-950/90 shadow-lg shadow-black/20 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-400/90">
              Quality · SPC
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">
              Process capability study
            </h1>
            <p className="mt-1 max-w-xl text-sm text-slate-400">
              X̄–R short-term capability using σ = R̄ / d₂. Export CSV or PDF for audit records.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={auditBtn} onClick={onExportCsv}>
              Export CSV
            </button>
            <button type="button" className={auditBtn} onClick={onExportPdf}>
              Export PDF
            </button>
            <form
              action={async () => {
                await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
                window.location.assign("/");
              }}
            >
              <button className={ghostBtn} type="submit">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <section className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-5 shadow-inner shadow-black/20 ring-1 ring-white/5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Study configuration</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Part name" value={partName} onChange={setPartName} />
            <Field label="Part no." value={partNo} onChange={setPartNo} />
            <Field label="Operation" value={operation} onChange={setOperation} />
            <Field label="Machine no." value={machineNo} onChange={setMachineNo} />
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
              Date
              <input
                className={inputClass}
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
              />
            </label>
            <Field label="Instrument name" value={instrumentName} onChange={setInstrumentName} />
            <Field label="Target" value={target} onChange={setTarget} placeholder="Nominal" />
            <Field label="Upper tolerance (USL)" value={usl} onChange={setUsl} placeholder="Numeric" />
            <Field label="Lower tolerance (LSL)" value={lsl} onChange={setLsl} placeholder="Numeric" />
          </div>
        </section>

        <section className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-5 ring-1 ring-white/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Data collection</h2>
              <p className="mt-1 text-sm text-slate-400">
                Subgroups: {rows} · Size: {cols} · Complete subgroups for calc: {completeSubgroups.length}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                No. of subgroups
                <input
                  className={`${inputClass} w-28`}
                  type="number"
                  min={1}
                  max={100}
                  value={numSubgroups}
                  onChange={(e) => setNumSubgroups(clampInt(Number(e.target.value), 1, 100))}
                />
              </label>
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Subgroup size
                <input
                  className={`${inputClass} w-28`}
                  type="number"
                  min={2}
                  max={25}
                  value={subgroupSize}
                  onChange={(e) => setSubgroupSize(clampInt(Number(e.target.value), 2, 25))}
                />
              </label>
              <button type="button" className={exampleBtn} onClick={onLoadExample}>
                Load example data
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-700/90 bg-slate-950/40">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/80 text-left text-xs uppercase tracking-wide text-slate-300">
                  <th className="sticky left-0 z-10 bg-slate-800/95 px-3 py-2 font-semibold">Sg</th>
                  {Array.from({ length: cols }, (_, c) => (
                    <th key={c} className="px-2 py-2 font-semibold text-amber-200/90">
                      M{c + 1}
                    </th>
                  ))}
                  <th className="px-3 py-2 font-semibold text-emerald-300/90">X̄</th>
                  <th className="px-3 py-2 font-semibold text-emerald-300/90">R</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: rows }, (_, r) => {
                  const sg = result?.subgroups.find((s) => s.index === r + 1);
                  return (
                    <tr key={r} className="border-b border-slate-800/90 hover:bg-slate-800/30">
                      <td className="sticky left-0 z-10 bg-slate-950/90 px-3 py-1.5 font-mono text-xs text-slate-400">
                        {r + 1}
                      </td>
                      {Array.from({ length: cols }, (_, c) => (
                        <td key={c} className="p-0.5">
                          <input
                            className="h-9 w-full min-w-[4.5rem] rounded border border-slate-700/80 bg-slate-900 px-2 font-mono text-xs text-slate-100 outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30"
                            inputMode="decimal"
                            value={cells[r]?.[c] ?? ""}
                            onChange={(e) => setCell(r, c, e.target.value)}
                            aria-label={`Subgroup ${r + 1} measurement ${c + 1}`}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1.5 font-mono text-xs text-emerald-200/95">
                        {sg ? formatCapability(sg.mean, 6) : "—"}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-xs text-emerald-200/95">
                        {sg ? formatCapability(sg.range, 6) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-5 ring-1 ring-white/5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Calculation engine</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Stat label="Grand mean (X̄̄)" value={result ? formatCapability(result.grandMean, 6) : "—"} />
              <Stat label="Average range (R̄)" value={result ? formatCapability(result.averageRange, 6) : "—"} />
              <Stat label="d₂ (constant)" value={result ? formatCapability(result.d2, 4) : "—"} />
              <Stat label="Estimated σ (R̄/d₂)" value={result ? formatCapability(result.sigma, 6) : "—"} />
              <Stat label="Cp" value={result ? formatCapability(result.cp, 4) : "—"} />
              <Stat label="Cpk" value={result ? formatCapability(result.cpk, 4) : "—"} highlight={cpkLow} large />
              <Stat
                label="Pp (overall s)"
                value={longTerm ? formatCapability(longTerm.pp, 4) : "—"}
              />
              <Stat
                label="Ppk (overall s)"
                value={longTerm ? formatCapability(longTerm.ppk, 4) : "—"}
                highlight={longTerm != null && longTerm.ppk < 1.33}
                large
              />
            </dl>
            {computeError ? (
              <p className="mt-4 rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-100/90">
                {computeError}
              </p>
            ) : null}
          </div>

          <div
            className={`flex flex-col justify-center rounded-xl border p-6 shadow-lg ring-1 ${
              cpkLow
                ? "border-red-700/60 bg-red-950/40 ring-red-500/20"
                : "border-emerald-800/50 bg-emerald-950/30 ring-emerald-500/15"
            }`}
          >
            <p className="text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
              Final capability index
            </p>
            <p
              className={`mt-2 text-center font-mono text-4xl font-bold tracking-tight sm:text-5xl ${
                cpkLow ? "text-red-400" : "text-emerald-400"
              }`}
            >
              Cpk = {cpkDisplay}
            </p>
            {cpkLow ? (
              <p className="mt-3 text-center text-sm font-medium text-red-300/95">
                Warning: Cpk is below the common minimum benchmark of 1.33.
              </p>
            ) : result ? (
              <p className="mt-3 text-center text-sm text-emerald-200/80">Meets typical Cpk ≥ 1.33 expectation.</p>
            ) : (
              <p className="mt-3 text-center text-sm text-slate-500">Enter data and specification limits.</p>
            )}
          </div>
        </section>

        {result && chartsReady ? (
          <SpcChartsPanel
            result={result}
            subgroupSize={cols}
            usl={uslNum}
            lsl={lslNum}
          />
        ) : result && !chartsReady ? (
          <section className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-5 text-sm text-slate-400 ring-1 ring-white/5">
            Loading charts…
          </section>
        ) : null}
      </main>
    </div>
  );
}

const inputClass =
  "mt-1.5 block w-full rounded-lg border border-slate-600 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20";

const auditBtn =
  "rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 shadow hover:bg-slate-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-500/40";

const ghostBtn =
  "rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-500/40";

const exampleBtn =
  "shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-100/95 shadow-sm hover:bg-amber-500/20 focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-400/50";

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
      {props.label}
      <input
        className={inputClass}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
      />
    </label>
  );
}

function Stat(props: {
  label: string;
  value: string;
  highlight?: boolean;
  large?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        props.highlight
          ? "border-red-600/50 bg-red-950/25"
          : "border-slate-700/80 bg-slate-950/50"
      }`}
    >
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{props.label}</dt>
      <dd className={`font-mono text-slate-100 ${props.large ? "text-xl font-semibold" : "text-sm"}`}>
        {props.value}
      </dd>
    </div>
  );
}
