import type { FolderRecord } from "@/types/folder";

function parseTimeHm(s: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

/**
 * Computes when the next fill is due after a form is finalized, using folder rules.
 * Returns null if the folder has no refill deadline configured.
 */
export function computeNextFillDueAt(anchorIso: string, folder: FolderRecord): string | null {
  const hours = folder.nextFillDueHours;
  if (hours != null && Number.isFinite(hours) && hours > 0) {
    const t = new Date(anchorIso).getTime() + hours * 3600 * 1000;
    return new Date(t).toISOString();
  }

  const days = folder.nextFillDueDays;
  const timeStr = folder.nextFillDueTime?.trim();
  if (days != null && Number.isFinite(days) && days >= 0 && timeStr) {
    const hm = parseTimeHm(timeStr);
    if (!hm) return null;
    const d = new Date(anchorIso);
    if (Number.isNaN(d.getTime())) return null;
    d.setDate(d.getDate() + Math.floor(days));
    d.setHours(hm.h, hm.m, 0, 0);
    return d.toISOString();
  }

  return null;
}
