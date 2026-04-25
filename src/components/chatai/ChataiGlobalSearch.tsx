"use client";

import * as React from "react";
import type { GlobalSearchHit } from "@/lib/chatai/global-search";

export const MANAGER_PENDING_KEY = "ifb_manager_pending_search";
export const MANAGER_PENDING_FLAG = "ifb_manager_open_search";

function MagnifyingGlassIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
      />
    </svg>
  );
}

const ACCENT = {
  input: "focus:border-violet-500/45 focus:ring-violet-500/20",
  searchBtn: "text-violet-700 hover:bg-violet-50",
  activeRow: "bg-violet-50 text-violet-950",
  subtitle: "text-violet-800/85",
} as const;

type ChataiGlobalSearchProps = {
  /** `login`: save query for after sign-in. `page`: full search on the workspace search page. */
  variant: "login" | "page";
};

export function ChataiGlobalSearch({ variant }: ChataiGlobalSearchProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hits, setHits] = React.useState<GlobalSearchHit[]>([]);
  const [loginHint, setLoginHint] = React.useState<string | null>(null);

  const isLogin = variant === "login";
  const a = ACCENT;
  const pendingKey = MANAGER_PENDING_KEY;
  const pendingFlag = MANAGER_PENDING_FLAG;
  const listId = "workspace-search-results-manager";

  const fetchHits = React.useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/chatai/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ q: q.trim() }),
    });
    setLoading(false);
    if (!res.ok) {
      setHits([]);
      setError(res.status === 401 ? "Session expired—sign in again." : "Search failed.");
      return;
    }
    const data = (await res.json()) as { hits?: GlobalSearchHit[]; error?: string | null };
    if (data.error) {
      setError(data.error);
      setHits([]);
      return;
    }
    setError(null);
    setHits(Array.isArray(data.hits) ? data.hits : []);
  }, []);

  React.useEffect(() => {
    if (isLogin) return;
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(pendingFlag) === "1") {
        const pending = sessionStorage.getItem(pendingKey) ?? "";
        if (pending.trim().length >= 2) {
          sessionStorage.removeItem(pendingFlag);
          setQuery(pending);
          setOpen(true);
          void fetchHits(pending);
        }
      }
    } catch {
      /* ignore */
    }
  }, [isLogin, fetchHits, pendingKey, pendingFlag]);

  React.useEffect(() => {
    if (isLogin) return;
    const t = query.trim();
    if (t.length < 2) {
      setHits([]);
      return;
    }
    const h = window.setTimeout(() => void fetchHits(t), 380);
    return () => window.clearTimeout(h);
  }, [query, isLogin, fetchHits]);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const el = rootRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  React.useEffect(() => {
    setActive(0);
  }, [query, open, hits]);

  function runSearch(q: string) {
    if (isLogin) {
      const t = q.trim();
      if (t.length < 2) {
        setError("Enter at least 2 characters.");
        return;
      }
      setError(null);
      try {
        sessionStorage.setItem(pendingKey, t);
        sessionStorage.setItem(pendingFlag, "1");
      } catch {
        /* ignore */
      }
      setLoginHint("After you sign in, you’ll be taken to Workspace search with this query.");
      setOpen(false);
      return;
    }
    void fetchHits(q);
  }

  function onChoose(hit: GlobalSearchHit) {
    if (isLogin) return;
    if (hit.href) {
      window.location.assign(hit.href);
    }
  }

  const list = isLogin ? [] : hits;
  const showList = open && (isLogin ? false : !loading && list.length > 0);
  const showEmpty = open && !isLogin && !loading && query.trim().length >= 2 && list.length === 0 && !error;

  return (
    <div ref={rootRef} className="relative w-full min-w-0 max-w-md">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">Workspace search</p>
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setError(null);
            if (!isLogin) setHits([]);
            setLoginHint(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              (e.target as HTMLInputElement).blur();
              return;
            }
            if (isLogin) {
              if (e.key === "Enter") {
                e.preventDefault();
                void runSearch(query);
              }
              return;
            }
            if (!open || list.length === 0) {
              if (e.key === "Enter" && query.trim().length >= 2) {
                e.preventDefault();
                void runSearch(query);
              }
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => (i + 1) % list.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => (i - 1 + list.length) % list.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              const h = list[active];
              if (h) onChoose(h);
            }
          }}
          placeholder={isLogin ? "Search users, forms, submissions…" : "Search all workspace data…"}
          autoComplete="off"
          aria-label="Global workspace search"
          aria-expanded={open}
          aria-controls={listId}
          className={`w-full rounded-lg border border-zinc-200 bg-white py-2 pl-3 pr-24 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:ring-2 ${a.input}`}
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1">
          <span className="flex w-8 items-center justify-center text-zinc-400" aria-hidden>
            <MagnifyingGlassIcon className="h-4 w-4" />
          </span>
        </div>
        {!isLogin && query.trim().length >= 2 ? (
          <button
            type="button"
            className={`absolute inset-y-0 right-8 z-10 my-auto h-7 rounded-md px-2 text-xs font-medium ${a.searchBtn}`}
            onClick={() => void runSearch(query)}
          >
            {loading ? "…" : "Search"}
          </button>
        ) : null}
      </div>

      {isLogin && loginHint ? <p className="mt-2 text-xs leading-relaxed text-zinc-600">{loginHint}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-[min(20rem,55vh)] overflow-auto rounded-xl border border-zinc-200/90 bg-white py-1 text-sm shadow-lg shadow-zinc-950/10 ring-1 ring-zinc-950/[0.04]"
        >
          {list.map((h, i) => (
            <li key={`${h.kind}-${h.title}-${i}`} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                className={`flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left transition-colors ${
                  i === active ? a.activeRow : "text-zinc-800 hover:bg-zinc-50"
                }`}
                onMouseEnter={() => setActive(i)}
                onClick={() => onChoose(h)}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  {h.kind.replace(/_/g, " ")}
                </span>
                <span className="font-medium">{h.title}</span>
                <span className={`text-xs ${i === active ? a.subtitle : "text-zinc-500"}`}>{h.subtitle}</span>
                {h.href ? (
                  <span className="font-mono text-[11px] text-zinc-400">Open → {h.href}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {isLogin && open && !loginHint ? (
        <p className="mt-2 text-xs text-zinc-500">
          Search everything in the app; after sign-in, open any result to go to the folder, submission, or page (same
          as browsing from the manager workspace).
        </p>
      ) : null}

      {showEmpty ? (
        <p className="mt-2 text-xs text-zinc-500">No matches. Try different words or a submission / folder id prefix.</p>
      ) : null}
    </div>
  );
}
