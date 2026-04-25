import { calendarYearFromQuery, resolveDateWindowFromQuery } from "./time-windows";
import type { ParsedIntent } from "./types";

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Pull a username token after phrases like "for user", "by", etc. */
function extractUsername(q: string): string | undefined {
  const patterns: RegExp[] = [
    /\bwhat\s+(?:did|do|does|have|has)\s+([a-z0-9][\w.-]{0,48})\s+(?:fill|enter|type|submit|write)\b/i,
    /\b(?:did|do|does)\s+([a-z0-9][\w.-]{0,48})\s+(?:fill|enter|type|submit|write)\b/i,
    /\b(?:show|tell|give)\s+me\s+(?:what\s+)?([a-z0-9][\w.-]{0,48})\s+(?:filled|submitted|entered|typed)\b/i,
    /\bdata\s+for\s+(?:user\s+)?([a-z0-9][\w.-]{0,48})\b/i,
    /\bentries\s+for\s+(?:user\s+)?([a-z0-9][\w.-]{0,48})\b/i,
    /\b(?:logs?|entries|activity)\s+for\s+(?:user\s+)?([a-z0-9][\w.-]{0,48})\b/i,
    /\bsubmissions?\s+(?:by|for)\s+(?:user\s+)?([a-z0-9][\w.-]{0,48})\b/i,
    /\buser\s+([a-z0-9][\w.-]{0,48})\s+(?:logs?|activity|submissions?|filled|data|values|entered)\b/i,
    /\b(?:for|by)\s+user\s+([a-z0-9][\w.-]{0,48})\b/i,
  ];
  for (const re of patterns) {
    const m = q.match(re);
    if (m?.[1]) return m[1].toLowerCase();
  }
  return undefined;
}

/**
 * Only treat as submission id when the user clearly refers to a submission record,
 * or pastes a lone UUID — avoids hijacking questions that mention template/folder ids.
 */
function extractSubmissionId(q: string): string | undefined {
  const uuid = "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})";
  const wired =
    q.match(new RegExp(`\\bsubmissions?\\s+id\\s*[:\\s#=-]*\\s*${uuid}\\b`, "i")) ||
    q.match(new RegExp(`\\bsubmission\\s+id\\s*[:\\s#=-]*\\s*${uuid}\\b`, "i")) ||
    q.match(new RegExp(`\\bsubmissions?\\s+${uuid}\\b`, "i")) ||
    q.match(/\bsubmission\s+([0-9a-f]{4,})\b/i) ||
    q.match(new RegExp(`\\bopen\\s+submission\\s+${uuid}\\b`, "i")) ||
    q.match(new RegExp(`\\brecord\\s+id\\s*[:\\s#=-]*\\s*${uuid}\\b`, "i"));
  const hit = wired?.[1];
  if (hit) {
    return hit.toLowerCase();
  }
  const collapsed = q.replace(/\s+/g, "");
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(collapsed)) {
    return collapsed.toLowerCase();
  }
  return undefined;
}

/** Folder name (or id prefix) from natural phrasing. */
function extractFolderQuery(q: string): string | undefined {
  const patterns: RegExp[] = [
    /\bin\s+folder\s+["']?([^"'\n]+)/i,
    /\bfolder\s+["']?([^"'\n]+?)["']?(?:\s*$|\s+with|\s+submissions?|\s+filled|\s+data|\s+show)/i,
    /\bsubmissions?\s+in\s+folder\s+["']?([^"'\n]+)/i,
    /\bfilled\s+(?:data\s+)?in\s+folder\s+["']?([^"'\n]+)/i,
    /\bwhich\s+forms?\s+(?:are\s+)?in\s+folder\s+["']?([^"'\n]+)/i,
    /\bwhat(?:'s|s)?\s+in\s+folder\s+["']?([^"'\n]+)/i,
  ];
  for (const re of patterns) {
    const m = q.match(re);
    if (m?.[1]) return m[1].trim().toLowerCase();
  }
  return undefined;
}

/** True when the question is clearly about entered line / form values (not user accounts). */
function asksAboutFilledContent(q: string): boolean {
  return (
    /\b(filled|fill|filling|entered|entry|entries|typed|wrote|written|responses?|answers?|values?|inputs?|captured|recorded|submitted|cells?|grid|line\s+data|sheet|clipboard)\b/i.test(
      q,
    ) ||
    /\b(form|submission)\s+data\b/i.test(q) ||
    /\b(what|which|how)\s+data\b/i.test(q) ||
    /\bwhat\s+.+\s+(fill|enter|type|submit)\b/i.test(q) ||
    /\b(how|what)\s+.+\s+(operators?|users?)\s+.+\s+(fill|enter|type|submit|put|save)\b/i.test(q)
  );
}

type Rule = {
  id: string;
  /** Higher runs first when multiple match */
  priority: number;
  test: (q: string) => boolean;
  params: (q: string) => Record<string, string | number | undefined>;
};

const rules: Rule[] = [
  {
    id: "submission_detail",
    priority: 108,
    test: (q) => Boolean(extractSubmissionId(q)),
    params: (q) => ({ submissionId: extractSubmissionId(q)! }),
  },
  {
    id: "user_filled_data",
    priority: 103,
    test: (q) => {
      const who = extractUsername(q);
      if (!who) return false;
      if (
        /\b(filled|fill|values|entered|responses?|fields?|answers?|typed|wrote|input|captured|recorded|submitted|submit)\b/i.test(
          q,
        )
      ) {
        return true;
      }
      if (
        /\b(what|which|show|tell|see|list|give|read)\b/i.test(q) &&
        /\b(data|answers|values|fields|forms?|submissions?|sheet|grid|cells?|lines?)\b/i.test(q)
      ) {
        return true;
      }
      return false;
    },
    params: (q) => ({ username: extractUsername(q)! }),
  },
  {
    id: "user_activity",
    priority: 100,
    test: (q) =>
      /\b(logs?|entries|activity|submissions?)\b/.test(q) &&
      (/\bfor\b/.test(q) || /\bby\b/.test(q) || /\buser\b/.test(q)) &&
      Boolean(extractUsername(q)) &&
      !asksAboutFilledContent(q),
    params: (q) => ({ username: extractUsername(q)! }),
  },
  {
    id: "audit_reports",
    priority: 90,
    test: (q) =>
      /\baudit\b/.test(q) ||
      (/\breports?\b/.test(q) &&
        (/\bsubmissions?\b/.test(q) ||
          /\bforms?\b/.test(q) ||
          resolveDateWindowFromQuery(q) !== null ||
          /\blast\s+month\b/.test(q) ||
          /\bthis\s+month\b/.test(q) ||
          /\bmonth\b/.test(q) ||
          /\bweek\b/.test(q) ||
          /\byear\b/.test(q) ||
          /\btoday\b/.test(q))),
    params: (q) => {
      const w = resolveDateWindowFromQuery(q);
      return w ? { windowLabel: w.label } : {};
    },
  },
  {
    id: "folder_submissions",
    priority: 96,
    test: (q) =>
      Boolean(extractFolderQuery(q)) &&
      /\b(folder|submissions?|filled|forms?|entries|data|which|what|in)\b/i.test(q),
    params: (q) => ({ folderQuery: extractFolderQuery(q)! }),
  },
  {
    id: "revenue_year",
    priority: 85,
    test: (q) =>
      /\b(revenue|sales|income|turnover)\b/.test(q) &&
      (/\bthis\s+year\b/.test(q) ||
        /\bcurrent\s+year\b/.test(q) ||
        /\blast\s+year\b/.test(q) ||
        /\b(19|20)\d{2}\b/.test(q) ||
        /\byear\b/.test(q)),
    params: (q) => ({ year: calendarYearFromQuery(q) }),
  },
  {
    id: "pending_tasks",
    priority: 80,
    test: (q) =>
      (/\bpending\b/.test(q) || /\bongoing\b/.test(q) || /\bincomplete\b/.test(q) || /\bdraft\b/.test(q)) &&
      (/\btasks?\b/.test(q) || /\bsubmissions?\b/.test(q) || /\bforms?\b/.test(q) || /\bopen\b/.test(q)),
    params: () => ({}),
  },
  {
    id: "filled_overview",
    priority: 72,
    test: (q) =>
      (/\b(all|every|recent|latest|list)\b/i.test(q) &&
        /\b(filled|entries|responses|values|data|submission)\b/i.test(q)) ||
      /\bwhat\s+data\b/i.test(q) ||
      /\bshow\s+(?:me\s+)?(?:all\s+)?(?:filled|entered)\b/i.test(q) ||
      /\ball\s+(?:form\s+)?(?:data|entries|responses)\b/i.test(q) ||
      (/\b(operator|operators|users?)\b/i.test(q) &&
        /\b(filled|fill|entered|typed|submitted|wrote|captured)\b/i.test(q)) ||
      (/\b(filled|entered|typed|captured)\b/i.test(q) &&
        /\b(operator|form|sheet|line|grid|cell|submission|factory|floor)\b/i.test(q)) ||
      /\b(line|factory)\s+data\b/i.test(q) ||
      /\bentered\s+data\b/i.test(q) ||
      /\bread\s+back\b.*\b(form|submission|data|values)\b/i.test(q),
    params: () => ({}),
  },
  {
    id: "users_list",
    priority: 70,
    test: (q) =>
      !asksAboutFilledContent(q) &&
      ((/\busers?\b/.test(q) && (/\ball\b/.test(q) || /\blist\b/.test(q) || /\bshow\b/.test(q) || /\bevery\b/.test(q) || /\bwho\b/.test(q))) ||
        /\boperators?\b/.test(q) ||
        /\blogins?\b/.test(q)),
    params: () => ({}),
  },
  {
    id: "templates_list",
    priority: 60,
    test: (q) =>
      (/\btemplates?\b/.test(q) || /\bforms?\b/.test(q)) &&
      (/\blist\b/.test(q) || /\bshow\b/.test(q) || /\ball\b/.test(q) || /\bhow\s+many\b/.test(q)),
    params: () => ({}),
  },
  {
    id: "folders_list",
    priority: 55,
    test: (q) =>
      /\bfolders?\b/.test(q) && (/\blist\b/.test(q) || /\bshow\b/.test(q) || /\ball\b/.test(q) || /\bsummary\b/.test(q)),
    params: () => ({}),
  },
  {
    id: "submissions_summary",
    priority: 50,
    test: (q) =>
      /\bhow\s+many\b/.test(q) ||
      /\bcount\b/.test(q) ||
      (/\bsubmissions?\b/.test(q) && (/\btotal\b/.test(q) || /\bsummary\b/.test(q) || /\bstats?\b/.test(q))),
    params: (q) => {
      const w = resolveDateWindowFromQuery(q);
      return w ? { windowLabel: w.label } : {};
    },
  },
  {
    id: "filled_data_catchall",
    priority: 38,
    test: (q) => {
      if (/\b(revenue|sales|income|turnover|price|cost)\b/i.test(q)) return false;
      const dataCue = asksAboutFilledContent(q);
      const scopeCue =
        /\b(form|forms|sheet|submission|submissions|line|operator|operators|users?|field|fields|folder|template|factory|floor)\b/i.test(
          q,
        );
      const qCue = /\b(what|which|show|list|tell|see|display|read|any|everything|how)\b/i.test(q);
      return dataCue && (scopeCue || qCue);
    },
    params: () => ({}),
  },
  {
    id: "refill_notifications",
    priority: 45,
    test: (q) => /\brefill\b/.test(q) || /\bnotifications?\b/.test(q) || /\balerts?\b/.test(q),
    params: () => ({}),
  },
];

export function parseIntent(raw: string): ParsedIntent {
  const q = norm(raw);
  if (!q) return { matched: false };

  const hits = rules.filter((r) => r.test(q)).sort((a, b) => b.priority - a.priority);
  const top = hits[0];
  if (!top) return { matched: false };

  return {
    matched: true,
    id: top.id,
    params: top.params(q),
  };
}

export function keywordsForIntent(intentId: string): string[] {
  const map: Record<string, string[]> = {
    submission_detail: ["submission", "id"],
    user_filled_data: ["filled", "user", "values"],
    user_activity: ["logs", "user", "activity"],
    folder_submissions: ["folder", "submissions"],
    filled_overview: ["filled", "data", "all"],
    filled_data_catchall: ["filled", "operators", "form"],
    audit_reports: ["audit", "reports", "month"],
    revenue_year: ["revenue", "year"],
    pending_tasks: ["pending", "tasks"],
    users_list: ["users", "show"],
    templates_list: ["templates", "forms"],
    folders_list: ["folders"],
    submissions_summary: ["submissions", "count"],
    refill_notifications: ["refill", "notifications"],
  };
  return map[intentId] ?? [];
}
