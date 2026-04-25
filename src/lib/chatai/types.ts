export type ChatBlock =
  | { type: "text"; text: string }
  | {
      type: "table";
      columns: { key: string; label: string }[];
      rows: Record<string, string | number | null>[];
    }
  | { type: "list"; items: string[] };

export type ChatQueryResult = {
  blocks: ChatBlock[];
  intentId: string | null;
  matchedKeywords: string[];
};

export type DateWindow = { start: Date; end: Date; label: string };

export type ParsedIntent =
  | {
      matched: true;
      id: string;
      params: Record<string, string | number | DateWindow | undefined>;
    }
  | { matched: false };
