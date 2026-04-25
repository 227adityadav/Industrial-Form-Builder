import {
  listFolderRecordsRaw,
  listRefillNotifications,
  listSubmissionsAll,
  listTemplateRowsForImport,
} from "@/lib/db/content";
import { listAppUsersForAdmin } from "@/lib/db/users";
import type { StoredFolder } from "@/lib/folder-record";
import type { FormSchema } from "@/types/form-schema";
import type { RefillNotificationRecord } from "@/types/refill-notification";
import type { SubmissionRecord } from "@/types/submission";
import { normalizeSubmissionStatus } from "@/types/submission";
import type { UserRecord } from "@/types/user";
import { calendarYearFromQuery, defaultReportWindow, resolveDateWindowFromQuery } from "./time-windows";
import { keywordsForIntent, parseIntent } from "./intent-parser";
import { flattenFilledFields, summarizeFilledInline, type FilledFieldRow } from "./submission-display";
import type { ChatBlock, ChatQueryResult, ParsedIntent } from "./types";
import type { DateWindow } from "./types";

export type ChataiDataSnapshot = {
  users: UserRecord[];
  submissions: SubmissionRecord[];
  schemas: FormSchema[];
  folders: StoredFolder[];
  refills: RefillNotificationRecord[];
};

let snapshotCache: { at: number; value: ChataiDataSnapshot } | null = null;
const SNAPSHOT_TTL_MS = 20_000;

function coerceSubmission(raw: SubmissionRecord): SubmissionRecord {
  return {
    id: raw.id,
    templateId: raw.templateId,
    folderId: raw.folderId,
    username: raw.username,
    submittedAt: raw.submittedAt,
    updatedAt: raw.updatedAt ?? raw.submittedAt,
    submissionStatus: normalizeSubmissionStatus(raw),
    top: raw.top ?? {},
    grid: raw.grid ?? null,
    footer: raw.footer ?? {},
    revealFills: raw.revealFills,
  };
}

async function loadChataiDataSnapshot(): Promise<ChataiDataSnapshot> {
  const now = Date.now();
  if (snapshotCache && now - snapshotCache.at < SNAPSHOT_TTL_MS) {
    return snapshotCache.value;
  }
  const [users, submissionsRaw, templatesRaw, folders, refills] = await Promise.all([
    listAppUsersForAdmin(),
    listSubmissionsAll(),
    listTemplateRowsForImport(),
    listFolderRecordsRaw(),
    listRefillNotifications(),
  ]);
  const submissions = submissionsRaw.map(coerceSubmission);
  const value: ChataiDataSnapshot = { users, submissions, schemas: templatesRaw, folders, refills };
  snapshotCache = { at: now, value };
  return value;
}

/** Shared data load for search and other chatai tools (same 20s cache as chat queries). */
export async function getChataiDataSnapshot(): Promise<ChataiDataSnapshot> {
  return loadChataiDataSnapshot();
}

function publicUserRow(u: UserRecord) {
  return {
    username: u.username,
    role: u.role,
    createdAt: u.createdAt.slice(0, 10),
  };
}

const NUM_RE = /^-?\d+(\.\d+)?$/;

function sumNumericLeaves(val: unknown, budget: { n: number }, depth: number): number {
  if (budget.n <= 0 || depth < 0) return 0;
  budget.n -= 1;
  if (val === null || val === undefined) return 0;
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string" && NUM_RE.test(val.trim())) {
    const x = parseFloat(val.trim());
    return Number.isFinite(x) ? x : 0;
  }
  if (Array.isArray(val)) {
    let s = 0;
    for (const x of val) {
      s += sumNumericLeaves(x, budget, depth - 1);
      if (budget.n <= 0) break;
    }
    return s;
  }
  if (typeof val === "object") {
    let s = 0;
    for (const v of Object.values(val as Record<string, unknown>)) {
      s += sumNumericLeaves(v, budget, depth - 1);
      if (budget.n <= 0) break;
    }
    return s;
  }
  return 0;
}

function submissionNumericTotal(s: SubmissionRecord): number {
  const budget = { n: 2500 };
  return (
    sumNumericLeaves(s.top, budget, 6) +
    sumNumericLeaves(s.footer, budget, 6) +
    sumNumericLeaves(s.grid, budget, 4) +
    (Array.isArray(s.revealFills)
      ? s.revealFills.reduce((acc, r) => acc + sumNumericLeaves(r.top, { n: 400 }, 4) + sumNumericLeaves(r.grid, { n: 800 }, 4), 0)
      : 0)
  );
}

function inWindow(iso: string, w: DateWindow): boolean {
  const t = new Date(iso).getTime();
  return t >= w.start.getTime() && t <= w.end.getTime();
}

function getSchema(snap: ChataiDataSnapshot, templateId: string): FormSchema | null {
  return snap.schemas.find((t) => t.id === templateId) ?? null;
}

/** Cheap count for tables (caps scan so large grids stay fast). */
function approxValueCount(s: SubmissionRecord, schema: FormSchema | null): string {
  const r = flattenFilledFields(s, schema, { maxRows: 101 });
  return r.length >= 101 ? "100+" : String(r.length);
}

function templateName(snap: ChataiDataSnapshot, id: string): string {
  return getSchema(snap, id)?.name ?? id.slice(0, 8);
}

function findSubmissionsByFolderQuery(snap: ChataiDataSnapshot, folderQuery: string): { folders: StoredFolder[]; subs: SubmissionRecord[] } {
  const q = folderQuery.trim().toLowerCase();
  const folders = snap.folders.filter(
    (f) => f.name.toLowerCase().includes(q) || f.id.toLowerCase().startsWith(q),
  );
  const ids = new Set(folders.map((f) => f.id));
  const subs = snap.submissions.filter((s) => s.folderId && ids.has(s.folderId));
  return { folders, subs };
}

function findSubmissionByIdToken(snap: ChataiDataSnapshot, token: string): SubmissionRecord | undefined {
  const t = token.toLowerCase();
  if (t.length >= 36) return snap.submissions.find((s) => s.id.toLowerCase() === t);
  return snap.submissions.find((s) => s.id.toLowerCase().startsWith(t));
}

function fieldValueTable(rows: FilledFieldRow[], maxRows: number): ChatBlock {
  const slice = rows.slice(0, maxRows);
  return {
    type: "table",
    columns: [
      { key: "section", label: "Section" },
      { key: "label", label: "Field" },
      { key: "value", label: "Filled value" },
    ],
    rows: slice.map((r) => ({ section: r.section, label: r.label, value: r.value })),
  };
}

function folderName(snap: ChataiDataSnapshot, id: string | undefined): string {
  if (!id) return "—";
  const f = snap.folders.find((x) => x.id === id);
  return f?.name ?? id.slice(0, 8);
}

async function handleUsersList(snap: ChataiDataSnapshot): Promise<ChatBlock[]> {
  const rows = snap.users.map(publicUserRow);
  return [
    { type: "text", text: `${rows.length} logins (passwords are never shown).` },
    {
      type: "table",
      columns: [
        { key: "username", label: "Username" },
        { key: "role", label: "Role" },
        { key: "createdAt", label: "Created" },
      ],
      rows,
    },
  ];
}

async function handleAuditReports(snap: ChataiDataSnapshot, message: string): Promise<ChatBlock[]> {
  const w = resolveDateWindowFromQuery(message) ?? defaultReportWindow();
  const rows = snap.submissions
    .filter((s) => inWindow(s.updatedAt, w) || inWindow(s.submittedAt, w))
    .slice(0, 200)
    .map((s) => {
      const schema = getSchema(snap, s.templateId);
      return {
        id: s.id.slice(0, 8),
        username: s.username ?? "—",
        template: templateName(snap, s.templateId),
        folder: folderName(snap, s.folderId),
        status: normalizeSubmissionStatus(s),
        updated: s.updatedAt.slice(0, 19).replace("T", " "),
        filledPreview: summarizeFilledInline(s, schema, 8),
      };
    });
  return [
    {
      type: "text",
      text: `Submission activity (${w.label}): ${rows.length} row(s) shown (max 200). **Filled preview** uses template labels (info fields, grids, footer, reveal rounds).`,
    },
    {
      type: "table",
      columns: [
        { key: "id", label: "Id" },
        { key: "username", label: "User" },
        { key: "template", label: "Form" },
        { key: "folder", label: "Folder" },
        { key: "status", label: "Status" },
        { key: "updated", label: "Updated" },
        { key: "filledPreview", label: "Filled (sample)" },
      ],
      rows,
    },
  ];
}

async function handleRevenueYear(snap: ChataiDataSnapshot, message: string): Promise<ChatBlock[]> {
  const year = calendarYearFromQuery(message);
  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();
  let total = 0;
  let n = 0;
  for (const s of snap.submissions) {
    const t = new Date(s.updatedAt).getTime();
    if (t < start || t >= end) continue;
    total += submissionNumericTotal(s);
    n += 1;
  }
  return [
    {
      type: "text",
      text:
        `Numeric rollup for **${year}** across **${n}** submission(s) touched in that year. ` +
        `This sums parseable numbers found in field values (top, footer, grids, reveal fills)—not a dedicated accounting ledger.`,
    },
    {
      type: "table",
      columns: [
        { key: "metric", label: "Metric" },
        { key: "value", label: "Value" },
      ],
      rows: [
        { metric: "Sum of numeric cell values", value: Math.round(total * 100) / 100 },
        { metric: "Submissions counted", value: n },
      ],
    },
  ];
}

async function handlePending(snap: ChataiDataSnapshot): Promise<ChatBlock[]> {
  const pending = snap.submissions.filter((s) => normalizeSubmissionStatus(s) === "ongoing");
  const rows = pending.slice(0, 150).map((s) => {
    const schema = getSchema(snap, s.templateId);
    return {
      id: s.id.slice(0, 8),
      username: s.username ?? "—",
      template: templateName(snap, s.templateId),
      folder: folderName(snap, s.folderId),
      updated: s.updatedAt.slice(0, 19).replace("T", " "),
      filledPreview: summarizeFilledInline(s, schema, 8),
    };
  });
  return [
    {
      type: "text",
      text: `Ongoing (non-final) submissions: **${pending.length}** (showing up to 150), with **folder** and a short **filled-field** sample per row.`,
    },
    {
      type: "table",
      columns: [
        { key: "id", label: "Id" },
        { key: "username", label: "User" },
        { key: "template", label: "Form" },
        { key: "folder", label: "Folder" },
        { key: "updated", label: "Updated" },
        { key: "filledPreview", label: "Filled (sample)" },
      ],
      rows,
    },
  ];
}

async function handleUserActivity(snap: ChataiDataSnapshot, username: string): Promise<ChatBlock[]> {
  const u = username.toLowerCase();
  const rows = snap.submissions
    .filter((s) => (s.username ?? "").toLowerCase() === u)
    .slice(0, 150)
    .map((s) => {
      const schema = getSchema(snap, s.templateId);
      return {
        id: s.id.slice(0, 8),
        template: templateName(snap, s.templateId),
        folder: folderName(snap, s.folderId),
        status: normalizeSubmissionStatus(s),
        submitted: s.submittedAt.slice(0, 19).replace("T", " "),
        updated: s.updatedAt.slice(0, 19).replace("T", " "),
        filledPreview: summarizeFilledInline(s, schema, 8),
      };
    });
  return [
    {
      type: "text",
      text: `Submissions for **${username}**: ${rows.length} (max 150). Each row includes **folder**, **form (template)**, and a short **filled-value** preview.`,
    },
    {
      type: "table",
      columns: [
        { key: "id", label: "Id" },
        { key: "template", label: "Form" },
        { key: "folder", label: "Folder" },
        { key: "status", label: "Status" },
        { key: "submitted", label: "Submitted" },
        { key: "updated", label: "Updated" },
        { key: "filledPreview", label: "Filled (sample)" },
      ],
      rows,
    },
  ];
}

async function handleTemplatesList(snap: ChataiDataSnapshot): Promise<ChatBlock[]> {
  const rows = snap.schemas.map((t) => ({ id: t.id.slice(0, 8), name: t.name }));
  return [
    { type: "text", text: `Templates: ${rows.length}` },
    {
      type: "table",
      columns: [
        { key: "id", label: "Id (prefix)" },
        { key: "name", label: "Name" },
      ],
      rows,
    },
  ];
}

async function handleFoldersList(snap: ChataiDataSnapshot): Promise<ChatBlock[]> {
  const rows = snap.folders.map((f) => ({
    id: f.id.slice(0, 8),
    name: f.name ?? "—",
    templates: f.templateIds?.length ?? 0,
  }));
  return [
    { type: "text", text: `Folders: ${rows.length}` },
    {
      type: "table",
      columns: [
        { key: "id", label: "Id (prefix)" },
        { key: "name", label: "Name" },
        { key: "templates", label: "Template count" },
      ],
      rows,
    },
  ];
}

async function handleSubmissionsSummary(snap: ChataiDataSnapshot, message: string): Promise<ChatBlock[]> {
  const w = resolveDateWindowFromQuery(message);
  const list = w
    ? snap.submissions.filter((s) => inWindow(s.updatedAt, w) || inWindow(s.submittedAt, w))
    : snap.submissions;
  const finalN = list.filter((s) => normalizeSubmissionStatus(s) === "final").length;
  const ongoingN = list.length - finalN;
  const folderIds = new Set(list.map((s) => s.folderId).filter(Boolean) as string[]);
  const lines = [
    w ? `Window: ${w.label}` : "All time",
    `Total submissions: ${list.length}`,
    `Final: ${finalN}`,
    `Ongoing: ${ongoingN}`,
    `Distinct folders: ${folderIds.size}`,
  ];
  const blocks: ChatBlock[] = [{ type: "list", items: lines }];

  const recent = [...list]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8);
  const previewRows = recent.map((s) => {
    const schema = getSchema(snap, s.templateId);
    return {
      id: s.id.slice(0, 8),
      user: s.username ?? "—",
      form: templateName(snap, s.templateId),
      folder: folderName(snap, s.folderId),
      status: normalizeSubmissionStatus(s),
      preview: summarizeFilledInline(s, schema, 6),
    };
  });
  blocks.push({
    type: "text",
    text: "**Latest in that set** — id, user, form, folder, status, and **values operators typed** (sample):",
  });
  blocks.push({
    type: "table",
    columns: [
      { key: "id", label: "Id" },
      { key: "user", label: "User" },
      { key: "form", label: "Form" },
      { key: "folder", label: "Folder" },
      { key: "status", label: "Status" },
      { key: "preview", label: "Filled (sample)" },
    ],
    rows: previewRows,
  });
  return blocks;
}

async function handleSubmissionDetail(snap: ChataiDataSnapshot, token: string): Promise<ChatBlock[]> {
  const s = findSubmissionByIdToken(snap, token);
  if (!s) {
    return [
      {
        type: "text",
        text: `No submission matches **${token}**. Say **submission id** plus the UUID, **submission** plus an id prefix, or paste the UUID alone on one line.`,
      },
    ];
  }
  const schema = getSchema(snap, s.templateId);
  const all = flattenFilledFields(s, schema, { maxRows: 400 });
  const truncated = all.length >= 400;
  const rows = all.slice(0, 350);
  const blocks: ChatBlock[] = [
    {
      type: "text",
      text:
        `**Form:** ${templateName(snap, s.templateId)} · **Folder:** ${folderName(snap, s.folderId)} · **User:** ${s.username ?? "—"} · **Status:** ${normalizeSubmissionStatus(s)} · **Submission id:** \`${s.id}\``,
    },
    {
      type: "text",
      text: `**${rows.length}** filled value(s) mapped from the template (info fields, grids, footer, reveal rounds).`,
    },
    fieldValueTable(rows, 350),
  ];
  if (truncated) {
    blocks.push({ type: "text", text: "_List truncated at 350 rows / 400 scanned—template may contain more cells._" });
  }
  return blocks;
}

async function handleUserFilledData(snap: ChataiDataSnapshot, username: string): Promise<ChatBlock[]> {
  const u = username.toLowerCase();
  const subs = snap.submissions.filter((s) => (s.username ?? "").toLowerCase() === u).slice(0, 40);
  if (!subs.length) {
    return [{ type: "text", text: `No submissions found for **${username}**.` }];
  }
  const overviewRows = subs.map((s) => {
    const schema = getSchema(snap, s.templateId);
    return {
      id: s.id.slice(0, 8),
      form: templateName(snap, s.templateId),
      folder: folderName(snap, s.folderId),
      status: normalizeSubmissionStatus(s),
      fields: approxValueCount(s, schema),
      preview: summarizeFilledInline(s, schema, 8),
    };
  });
  const blocks: ChatBlock[] = [
    {
      type: "text",
      text: `Filled **form data** for **${username}** — overview of **${subs.length}** submission(s) (max 40).`,
    },
    {
      type: "table",
      columns: [
        { key: "id", label: "Id" },
        { key: "form", label: "Form" },
        { key: "folder", label: "Folder" },
        { key: "status", label: "Status" },
        { key: "fields", label: "# Values" },
        { key: "preview", label: "Preview" },
      ],
      rows: overviewRows,
    },
  ];
  for (const s of subs.slice(0, 3)) {
    const schema = getSchema(snap, s.templateId);
    const fr = flattenFilledFields(s, schema, { maxRows: 90 });
    blocks.push({
      type: "text",
      text: `**Detail ·** ${templateName(snap, s.templateId)} · ${folderName(snap, s.folderId)} · \`${s.id.slice(0, 8)}…\``,
    });
    blocks.push(fieldValueTable(fr, 90));
  }
  if (subs.length > 3) {
    blocks.push({
      type: "text",
      text: `_Use **submission id** followed by the full UUID from the app to open another record in full._`,
    });
  }
  return blocks;
}

async function handleFolderSubmissions(snap: ChataiDataSnapshot, folderQuery: string): Promise<ChatBlock[]> {
  const { folders, subs } = findSubmissionsByFolderQuery(snap, folderQuery);
  if (!folders.length) {
    return [
      {
        type: "text",
        text: `No folder name or id contains **${folderQuery}**. Try **list all folders** to see exact names.`,
      },
    ];
  }
  const folderLine = folders.map((f) => `**${f.name}** (\`${f.id.slice(0, 8)}…\`)`).join(", ");
  const rows = subs.slice(0, 120).map((s) => {
    const schema = getSchema(snap, s.templateId);
    return {
      id: s.id.slice(0, 8),
      user: s.username ?? "—",
      form: templateName(snap, s.templateId),
      status: normalizeSubmissionStatus(s),
      updated: s.updatedAt.slice(0, 19).replace("T", " "),
      preview: summarizeFilledInline(s, schema, 8),
    };
  });
  return [
    {
      type: "text",
      text: `Matched folder(s): ${folderLine}. **${subs.length}** submission(s) in those folders (showing ${rows.length}).`,
    },
    {
      type: "table",
      columns: [
        { key: "id", label: "Id" },
        { key: "user", label: "User" },
        { key: "form", label: "Form filled" },
        { key: "status", label: "Status" },
        { key: "updated", label: "Updated" },
        { key: "preview", label: "Filled (sample)" },
      ],
      rows,
    },
  ];
}

async function handleFilledOverview(snap: ChataiDataSnapshot): Promise<ChatBlock[]> {
  const sorted = [...snap.submissions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  const head = sorted.slice(0, 36);
  const overviewRows = head.map((s) => {
    const schema = getSchema(snap, s.templateId);
    return {
      id: s.id.slice(0, 8),
      user: s.username ?? "—",
      form: templateName(snap, s.templateId),
      folder: folderName(snap, s.folderId),
      status: normalizeSubmissionStatus(s),
      values: approxValueCount(s, schema),
      preview: summarizeFilledInline(s, schema, 8),
    };
  });
  const blocks: ChatBlock[] = [
    {
      type: "text",
      text: `**Recent filled submissions** (newest first): **${head.length}** of **${snap.submissions.length}** total. Values include **operator-entered** cells (main form and **reveal rounds**), mapped to template field labels.`,
    },
    {
      type: "table",
      columns: [
        { key: "id", label: "Id" },
        { key: "user", label: "User" },
        { key: "form", label: "Form" },
        { key: "folder", label: "Folder" },
        { key: "status", label: "Status" },
        { key: "values", label: "# Values" },
        { key: "preview", label: "Preview" },
      ],
      rows: overviewRows,
    },
  ];
  for (const s of head.slice(0, 3)) {
    const schema = getSchema(snap, s.templateId);
    const fr = flattenFilledFields(s, schema, { maxRows: 85 });
    blocks.push({
      type: "text",
      text: `**Expanded ·** ${templateName(snap, s.templateId)} · ${folderName(snap, s.folderId)} · user **${s.username ?? "—"}**`,
    });
    blocks.push(fieldValueTable(fr, 85));
  }
  return blocks;
}

async function handleRefills(snap: ChataiDataSnapshot): Promise<ChatBlock[]> {
  const unread = snap.refills.filter((r) => !r.readAt);
  const dueSoon = snap.refills.filter((r) => {
    if (r.readAt) return false;
    return new Date(r.dueAt).getTime() <= Date.now();
  });
  const rows = snap.refills.slice(0, 80).map((r) => ({
    folder: r.folderName,
    template: r.templateName,
    user: r.username ?? "—",
    due: r.dueAt.slice(0, 19).replace("T", " "),
    read: r.readAt ? "yes" : "no",
  }));
  return [
    {
      type: "text",
      text: `Refill notifications: **${snap.refills.length}** total; **${unread.length}** unread; **${dueSoon.length}** due or overdue.`,
    },
    {
      type: "table",
      columns: [
        { key: "folder", label: "Folder" },
        { key: "template", label: "Template" },
        { key: "user", label: "User" },
        { key: "due", label: "Due" },
        { key: "read", label: "Read" },
      ],
      rows,
    },
  ];
}

const FALLBACK =
  "I didn't understand that. Try: **What data did operators fill**, **List all filled data**, **What did demo enter**, **Submissions in folder color**, **Submission id** plus the full UUID, **submission 80270f14** (id prefix), **Submissions by demo**, **How many submissions**, or **Pending tasks**.";

export async function runChatQuery(message: string): Promise<ChatQueryResult> {
  const parsed: ParsedIntent = parseIntent(message);
  if (!parsed.matched) {
    return { blocks: [{ type: "text", text: FALLBACK }], intentId: null, matchedKeywords: [] };
  }

  const snap = await loadChataiDataSnapshot();
  let blocks: ChatBlock[];

  switch (parsed.id) {
    case "submission_detail": {
      const token = parsed.params.submissionId as string | undefined;
      blocks = token ? await handleSubmissionDetail(snap, token) : [{ type: "text", text: FALLBACK }];
      break;
    }
    case "user_filled_data": {
      const u = parsed.params.username as string | undefined;
      blocks = u ? await handleUserFilledData(snap, u) : [{ type: "text", text: FALLBACK }];
      break;
    }
    case "folder_submissions": {
      const fq = parsed.params.folderQuery as string | undefined;
      blocks = fq ? await handleFolderSubmissions(snap, fq) : [{ type: "text", text: FALLBACK }];
      break;
    }
    case "filled_overview":
    case "filled_data_catchall":
      blocks = await handleFilledOverview(snap);
      break;
    case "users_list":
      blocks = await handleUsersList(snap);
      break;
    case "audit_reports":
      blocks = await handleAuditReports(snap, message);
      break;
    case "revenue_year":
      blocks = await handleRevenueYear(snap, message);
      break;
    case "pending_tasks":
      blocks = await handlePending(snap);
      break;
    case "user_activity": {
      const u = parsed.params.username as string | undefined;
      if (!u) {
        blocks = [{ type: "text", text: FALLBACK }];
      } else {
        blocks = await handleUserActivity(snap, u);
      }
      break;
    }
    case "templates_list":
      blocks = await handleTemplatesList(snap);
      break;
    case "folders_list":
      blocks = await handleFoldersList(snap);
      break;
    case "submissions_summary":
      blocks = await handleSubmissionsSummary(snap, message);
      break;
    case "refill_notifications":
      blocks = await handleRefills(snap);
      break;
    default:
      blocks = [{ type: "text", text: FALLBACK }];
  }

  return {
    blocks,
    intentId: parsed.id,
    matchedKeywords: keywordsForIntent(parsed.id),
  };
}
