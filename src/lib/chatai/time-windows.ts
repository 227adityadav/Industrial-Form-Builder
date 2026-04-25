import type { DateWindow } from "./types";

const MONTHS: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function resolveDateWindowFromQuery(qRaw: string, now = new Date()): DateWindow | null {
  const q = qRaw.trim().toLowerCase();

  if (/\btoday\b/.test(q)) {
    return { start: startOfDay(now), end: endOfDay(now), label: "today" };
  }
  if (/\byesterday\b/.test(q)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return { start: startOfDay(d), end: endOfDay(d), label: "yesterday" };
  }
  if (/\blast\s+week\b/.test(q)) {
    const end = endOfDay(now);
    const start = startOfDay(now);
    start.setDate(start.getDate() - 7);
    return { start, end, label: "last 7 days" };
  }
  if (/\blast\s+month\b/.test(q) || /\bpast\s+month\b/.test(q)) {
    const end = endOfDay(now);
    const start = startOfDay(now);
    start.setMonth(start.getMonth() - 1);
    return { start, end, label: "last month" };
  }
  if (/\bthis\s+month\b/.test(q)) {
    const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    const end = endOfDay(now);
    return { start, end, label: "this month" };
  }
  if (/\bthis\s+year\b/.test(q) || /\bcurrent\s+year\b/.test(q)) {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const end = endOfDay(now);
    return { start, end, label: `year ${now.getFullYear()}` };
  }
  if (/\blast\s+year\b/.test(q)) {
    const y = now.getFullYear() - 1;
    const start = new Date(y, 0, 1, 0, 0, 0, 0);
    const end = new Date(y, 11, 31, 23, 59, 59, 999);
    return { start, end, label: `year ${y}` };
  }

  for (const [name, idx] of Object.entries(MONTHS)) {
    const re = new RegExp(`\\b${name}\\b`, "i");
    if (!re.test(q)) continue;
    const yMatch = q.match(/\b(19|20)\d{2}\b/);
    const y = yMatch ? parseInt(yMatch[0], 10) : now.getFullYear();
    const start = new Date(y, idx, 1, 0, 0, 0, 0);
    const end = new Date(y, idx + 1, 0, 23, 59, 59, 999);
    return { start, end, label: `${name} ${y}` };
  }

  const iso = q.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const y = parseInt(iso[1], 10);
    const mo = parseInt(iso[2], 10) - 1;
    const day = parseInt(iso[3], 10);
    const start = new Date(y, mo, day, 0, 0, 0, 0);
    const end = endOfDay(start);
    return { start, end, label: iso[0] };
  }

  return null;
}

export function defaultReportWindow(now = new Date()): DateWindow {
  const end = endOfDay(now);
  const start = startOfDay(now);
  start.setDate(start.getDate() - 30);
  return { start, end, label: "last 30 days" };
}

export function calendarYearFromQuery(qRaw: string, now = new Date()): number {
  const q = qRaw.toLowerCase();
  const m = q.match(/\b(19|20)\d{2}\b/);
  if (m) return parseInt(m[0], 10);
  if (/\blast\s+year\b/.test(q)) return now.getFullYear() - 1;
  return now.getFullYear();
}
