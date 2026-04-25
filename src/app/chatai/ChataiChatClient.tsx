"use client";

import * as React from "react";
import Link from "next/link";
import type { ChatBlock } from "@/lib/chatai/types";

const STORAGE_KEY = "ifb_chatai_history_v1";

const SAMPLE_QUERIES = [
  "Show all users",
  "What data did operators fill",
  "List all filled data",
  "What did demo enter",
  "Filled values for user demo",
  "Submissions in folder color",
  "Get audit reports for last month",
  "Total revenue this year",
  "Pending tasks",
  "Submissions by demo",
  "How many submissions",
  "List all templates",
  "Show all folders",
  "Refill notifications",
];

type UserMsg = { kind: "user"; id: string; text: string; highlights?: string[] };
type AssistantMsg = { kind: "assistant"; id: string; blocks: ChatBlock[]; intentId: string | null };
type ChatMessage = UserMsg | AssistantMsg;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function richTextToHtml(text: string): string {
  const escaped = escapeHtml(text);
  return escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function highlightTerms(text: string, terms: string[] | undefined): React.ReactNode {
  if (!terms?.length) return text;
  const lower = text.toLowerCase();
  const hits = terms
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .filter((t) => lower.includes(t));
  if (!hits.length) return text;

  const pattern = new RegExp(`(${hits.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const pieces = text.split(pattern);
  return pieces.map((piece, i) => {
    const isHit = hits.some((h) => piece.toLowerCase() === h);
    if (isHit) {
      return (
        <mark key={i} className="rounded bg-amber-200/90 px-0.5 text-zinc-900">
          {piece}
        </mark>
      );
    }
    return piece;
  });
}

function loadHistory(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean) as ChatMessage[];
  } catch {
    return [];
  }
}

function saveHistory(messages: ChatMessage[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-80)));
  } catch {
    /* ignore quota */
  }
}

function BlocksView({ blocks }: { blocks: ChatBlock[] }) {
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((b, i) => {
        if (b.type === "text") {
          return (
            <div
              key={i}
              className="text-sm leading-relaxed text-zinc-800 [&_strong]:font-semibold"
              dangerouslySetInnerHTML={{ __html: richTextToHtml(b.text) }}
            />
          );
        }
        if (b.type === "list") {
          return (
            <ul key={i} className="list-inside list-disc text-sm text-zinc-800">
              {b.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          );
        }
        if (b.type === "table") {
          return (
            <div key={i} className="max-w-full overflow-x-auto rounded-lg border border-zinc-200/80 bg-white">
              <table className="min-w-full border-collapse text-left text-xs text-zinc-800">
                <thead className="bg-zinc-50 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                  <tr>
                    {b.columns.map((c) => (
                      <th key={c.key} className="whitespace-nowrap px-3 py-2">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((row, ri) => (
                    <tr key={ri} className="border-t border-zinc-100 odd:bg-white even:bg-zinc-50/60">
                      {b.columns.map((c) => (
                        <td key={c.key} className="whitespace-nowrap px-3 py-2 font-mono text-[11px] sm:text-xs">
                          {row[c.key] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

export function ChataiChatClient() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [suggestOpen, setSuggestOpen] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMessages(loadHistory());
  }, []);

  React.useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const suggestions = React.useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q) return SAMPLE_QUERIES.slice(0, 6);
    return SAMPLE_QUERIES.filter((s) => s.toLowerCase().includes(q)).slice(0, 8);
  }, [input]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.assign("/manager/login");
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userId = crypto.randomUUID();
    const userMsg: UserMsg = { kind: "user", id: userId, text: trimmed };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    const res = await fetch("/api/chatai/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: trimmed }),
    });
    setLoading(false);

    if (!res.ok) {
      setMessages((m) => [
        ...m,
        {
          kind: "assistant",
          id: crypto.randomUUID(),
          intentId: null,
          blocks: [
            {
              type: "text",
              text: res.status === 401 ? "Session expired—sign in again." : "Request failed. Try again.",
            },
          ],
        },
      ]);
      return;
    }

    const data = (await res.json()) as {
      blocks?: ChatBlock[];
      intentId?: string | null;
      matchedKeywords?: string[];
    };

    const blocks = Array.isArray(data.blocks) ? data.blocks : [{ type: "text", text: "No data." } as ChatBlock];
    const kws = Array.isArray(data.matchedKeywords) ? data.matchedKeywords : [];

    setMessages((m) => {
      const next = [...m];
      const ui = next.findIndex((x) => x.kind === "user" && x.id === userId);
      if (ui >= 0) {
        const x = next[ui] as UserMsg;
        next[ui] = { ...x, highlights: kws.length ? kws : x.highlights };
      }
      next.push({
        kind: "assistant",
        id: crypto.randomUUID(),
        intentId: data.intentId ?? null,
        blocks,
      });
      return next;
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send(input);
  }

  return (
    <div className="mx-auto flex h-dvh max-w-3xl flex-col bg-zinc-100 shadow-sm sm:h-[calc(100dvh-0px)]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200/90 bg-white/95 px-4 py-3 backdrop-blur">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">Chat query</p>
          <h1 className="text-sm font-semibold text-zinc-900">Industrial data (rule-based)</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link href="/chatai/search" className="ui-btn-ghost text-xs">
            Workspace search
          </Link>
          <button type="button" className="ui-btn-ghost text-xs" onClick={() => setMessages([])}>
            Clear chat
          </button>
          <button type="button" className="ui-btn-ghost text-xs" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </header>

      <div
        ref={listRef}
        className="flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-4"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-zinc-300/80 bg-white/80 px-4 py-6 text-center text-sm text-zinc-600">
            Ask about users, submissions, templates, folders, or refill alerts. Everything is parsed with fixed rules—no
            external AI.
          </div>
        ) : null}

        {messages.map((msg) =>
          msg.kind === "user" ? (
            <div key={msg.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-indigo-600 px-3.5 py-2.5 text-sm text-white shadow-sm">
                <p className="whitespace-pre-wrap leading-relaxed">{highlightTerms(msg.text, msg.highlights)}</p>
              </div>
            </div>
          ) : (
            <div key={msg.id} className="flex justify-start">
              <div className="max-w-[92%] space-y-2 rounded-2xl rounded-bl-md border border-zinc-200/90 bg-white px-3.5 py-3 shadow-sm">
                {msg.intentId ? (
                  <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Intent: {msg.intentId}</p>
                ) : null}
                <BlocksView blocks={msg.blocks} />
              </div>
            </div>
          ),
        )}

        {loading ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl border border-zinc-200/90 bg-white px-4 py-2.5 text-sm text-zinc-600 shadow-sm">
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600"
                aria-hidden
              />
              Querying…
            </div>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-zinc-200/90 bg-white/95 px-3 py-3 backdrop-blur sm:px-4">
        <datalist id="chatai-samples">
          {SAMPLE_QUERIES.map((q) => (
            <option key={q} value={q} />
          ))}
        </datalist>
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          {suggestOpen && input.trim() && suggestions.length ? (
            <div className="max-h-36 overflow-y-auto rounded-lg border border-zinc-200 bg-white text-sm shadow-md">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="block w-full px-3 py-2 text-left text-zinc-800 hover:bg-zinc-50"
                  onClick={() => {
                    setInput(s);
                    setSuggestOpen(false);
                    void send(s);
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                className="ui-input w-full pr-10"
                placeholder="Try: Show all users…"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setSuggestOpen(true);
                }}
                onFocus={() => setSuggestOpen(true)}
                onBlur={() => window.setTimeout(() => setSuggestOpen(false), 120)}
                list="chatai-samples"
                autoComplete="off"
                aria-label="Query"
              />
            </div>
            <button type="submit" disabled={loading || !input.trim()} className="ui-btn-primary shrink-0 px-5">
              Send
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_QUERIES.slice(0, 4).map((q) => (
              <button
                key={q}
                type="button"
                className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100"
                onClick={() => {
                  setInput(q);
                  void send(q);
                }}
              >
                {q}
              </button>
            ))}
          </div>
          <Link href="/" className="text-center text-[11px] text-zinc-500 hover:text-zinc-700">
            ← Home
          </Link>
        </form>
      </div>
    </div>
  );
}
