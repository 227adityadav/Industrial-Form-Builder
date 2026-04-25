import type { ReactNode } from "react";

const accents = {
  emerald: "from-emerald-600 via-teal-500 to-emerald-600",
  amber: "from-amber-500 via-orange-500 to-amber-600",
  violet: "from-violet-600 via-indigo-500 to-violet-600",
  cyan: "from-cyan-600 via-sky-500 to-cyan-600",
  indigo: "from-indigo-600 via-blue-500 to-indigo-600",
} as const;

export type AuthAccent = keyof typeof accents;

export function AuthShell({
  accent,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  accent: AuthAccent;
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="app-page relative flex min-h-dvh flex-col items-center justify-center px-4 py-12 sm:px-6">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,rgba(16,185,129,0.12),transparent_55%)]"
        aria-hidden
      />
      <div className="relative w-full max-w-md">
        <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-xl shadow-zinc-950/10 ring-1 ring-zinc-950/[0.05]">
          <div className={`h-1.5 w-full bg-gradient-to-r ${accents[accent]}`} aria-hidden />
          <div className="p-8">
          {eyebrow ? (
            <p className="ui-section-title mb-2">{eyebrow}</p>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
          {subtitle ? <div className="mt-2 text-sm leading-relaxed text-zinc-600">{subtitle}</div> : null}
          <div className="mt-8">{children}</div>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-zinc-500">
          Industrial Form Builder · secure internal workflows
        </p>
      </div>
    </div>
  );
}
