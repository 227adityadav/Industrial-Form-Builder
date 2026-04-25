import { listMasterFolders } from "@/lib/db/content";
import { normalizeFormSchema } from "@/lib/form-schema-normalize";
import type { FormSchema } from "@/types/form-schema";
import { normalizeSubmissionStatus } from "@/types/submission";
import { getChataiDataSnapshot, type ChataiDataSnapshot } from "@/lib/chatai/query-service";
import { flattenFilledFields, summarizeFilledInline } from "@/lib/chatai/submission-display";

export type GlobalSearchHit = {
  kind:
    | "page"
    | "user"
    | "master_folder"
    | "folder"
    | "template"
    | "submission"
    | "refill";
  title: string;
  subtitle: string;
  /** Opens in the app (manager-level routes where applicable). */
  href?: string;
};

const MAX_RESULTS = 72;

const STATIC_PAGES: { title: string; subtitle: string; href: string; terms: string }[] = [
  { title: "Home", subtitle: "Role picker and app entry", href: "/", terms: "home landing start" },
  { title: "Workspace search (Chat AI)", subtitle: "Find folders, submissions, and forms", href: "/chatai/search", terms: "search find lookup global chatai" },
  { title: "Workspace search (Manager)", subtitle: "Find folders, submissions, and forms", href: "/manager/search", terms: "search find lookup global manager" },
  { title: "Chat query console", subtitle: "Rule-based data questions", href: "/chatai", terms: "chatai chat query console" },
  { title: "Manager workspace", subtitle: "Site folders, submissions, master groups", href: "/manager", terms: "manager review" },
  { title: "Operator sign-in", subtitle: "Fill forms (operators)", href: "/login", terms: "operator user forms login" },
];

function termsFromQuery(q: string): string[] {
  return q
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .slice(0, 8);
}

function matches(haystack: string, terms: string[]): boolean {
  const h = haystack.toLowerCase();
  return terms.every((t) => h.includes(t));
}

function safeSchema(raw: FormSchema): FormSchema {
  try {
    return normalizeFormSchema(raw);
  } catch {
    return raw;
  }
}

function templateSearchBlob(s: FormSchema): string {
  const norm = safeSchema(s);
  return JSON.stringify(norm).slice(0, 24_000);
}

function getSchema(snap: ChataiDataSnapshot, templateId: string): FormSchema | null {
  const raw = snap.schemas.find((t) => t.id === templateId);
  return raw ? safeSchema(raw) : null;
}

function templateName(snap: ChataiDataSnapshot, id: string): string {
  return getSchema(snap, id)?.name ?? id.slice(0, 8);
}

function folderName(snap: ChataiDataSnapshot, id: string | undefined): string {
  if (!id) return "—";
  const f = snap.folders.find((x) => x.id === id);
  return f?.name ?? id.slice(0, 8);
}

function scoreForTerms(haystack: string, terms: string[]): number {
  const h = haystack.toLowerCase();
  let s = 0;
  for (const t of terms) {
    const i = h.indexOf(t);
    if (i < 0) return -1;
    s += 200 - Math.min(i, 200);
  }
  return s;
}

export async function runGlobalSearch(query: string): Promise<{
  hits: GlobalSearchHit[];
  error?: string;
}> {
  const q = query.trim();
  if (q.length < 2) {
    return { hits: [], error: "Enter at least 2 characters." };
  }
  const terms = termsFromQuery(q);
  if (terms.length === 0) {
    return { hits: [], error: "Enter a search term." };
  }

  const [snap, masters] = await Promise.all([getChataiDataSnapshot(), listMasterFolders()]);

  const scored: { hit: GlobalSearchHit; score: number }[] = [];

  for (const p of STATIC_PAGES) {
    const hay = `${p.title} ${p.subtitle} ${p.href} ${p.terms}`;
    if (!matches(hay, terms)) continue;
    const sc = scoreForTerms(hay, terms);
    if (sc < 0) continue;
    scored.push({
      score: sc,
      hit: {
        kind: "page",
        title: p.title,
        subtitle: `${p.subtitle} · ${p.href}`,
        href: p.href,
      },
    });
  }

  for (const u of snap.users) {
    const hay = `${u.username} ${u.role} ${u.createdAt ?? ""} user account login`;
    if (!matches(hay, terms)) continue;
    const sc = scoreForTerms(hay, terms);
    scored.push({
      score: sc + 5,
      hit: {
        kind: "user",
        title: `User · ${u.username}`,
        subtitle: `Role ${u.role} · created ${(u.createdAt ?? "—").slice(0, 10)}`,
        href: "/manager",
      },
    });
  }

  for (const m of masters) {
    const hay = `${m.name} ${m.id} master group folder`;
    if (!matches(hay, terms)) continue;
    const sc = scoreForTerms(hay, terms);
    scored.push({
      score: sc + 3,
      hit: {
        kind: "master_folder",
        title: `Master group · ${m.name}`,
        subtitle: `Id ${m.id.slice(0, 8)}… · created ${m.createdAt.slice(0, 10)}`,
        href: "/manager",
      },
    });
  }

  for (const f of snap.folders) {
    const hay = `${f.name} ${f.id} ${(f.templateIds ?? []).join(" ")} ${(f.allowedUsernames ?? []).join(" ")} site folder`;
    if (!matches(hay, terms)) continue;
    const sc = scoreForTerms(hay, terms);
    scored.push({
      score: sc + 8,
      hit: {
        kind: "folder",
        title: `Site folder · ${f.name}`,
        subtitle: `${(f.templateIds ?? []).length} template(s) · id ${f.id.slice(0, 8)}…`,
        href: `/manager/folder/${f.id}`,
      },
    });
  }

  for (const t of snap.schemas) {
    const name = t.name ?? "Form";
    const blob = templateSearchBlob(t);
    const hay = `${name} ${t.id} ${blob} form template builder`;
    if (!matches(hay, terms)) continue;
    const sc = scoreForTerms(hay, terms);
    scored.push({
      score: sc + 6,
      hit: {
        kind: "template",
        title: `Form template · ${name}`,
        subtitle: `Id ${t.id.slice(0, 8)}… · open manager workspace to browse forms in folders`,
        href: "/manager",
      },
    });
  }

  for (const s of snap.submissions) {
    const schema = getSchema(snap, s.templateId);
    const flat = flattenFilledFields(s, schema, { maxRows: 320 });
    const filledText = flat.map((r) => `${r.label} ${r.value} ${r.section}`).join(" | ");
    const st = normalizeSubmissionStatus(s);
    const hay = [
      s.id,
      s.username ?? "",
      s.templateId,
      templateName(snap, s.templateId),
      s.folderId ?? "",
      folderName(snap, s.folderId),
      st,
      s.submittedAt,
      s.updatedAt,
      filledText,
      JSON.stringify(s.top).slice(0, 4_000),
      JSON.stringify(s.footer).slice(0, 2_000),
      s.grid != null ? JSON.stringify(s.grid).slice(0, 8_000) : "",
    ].join(" | ");
    if (!matches(hay, terms)) continue;
    const sc = scoreForTerms(hay, terms);
    const preview = summarizeFilledInline(s, schema, 10);
    scored.push({
      score: sc + 25,
      hit: {
        kind: "submission",
        title: `Submission · ${s.username ?? "—"} · ${templateName(snap, s.templateId)}`,
        subtitle: `${folderName(snap, s.folderId)} · ${st} · ${preview}`.slice(0, 220),
        href: `/manager/submission/${s.id}`,
      },
    });
  }

  for (const r of snap.refills) {
    const hay = `${r.folderName} ${r.templateName} ${r.username ?? ""} ${r.folderId} ${r.templateId} ${r.submissionId} ${r.dueAt} ${r.readAt ? "read" : "unread"} refill due`;
    if (!matches(hay, terms)) continue;
    const sc = scoreForTerms(hay, terms);
    scored.push({
      score: sc + 4,
      hit: {
        kind: "refill",
        title: `Refill · ${r.folderName} · ${r.templateName}`,
        subtitle: `User ${r.username ?? "—"} · due ${r.dueAt.slice(0, 16).replace("T", " ")} · ${r.readAt ? "read" : "unread"}`,
        href: "/manager",
      },
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const hits = scored.slice(0, MAX_RESULTS).map((x) => x.hit);
  return { hits };
}
