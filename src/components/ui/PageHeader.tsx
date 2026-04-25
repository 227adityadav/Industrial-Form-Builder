import type { ReactNode } from "react";

const maxWidths = {
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
} as const;

export type PageHeaderMaxWidth = keyof typeof maxWidths;

export function PageHeader({
  title,
  description,
  children,
  maxWidth = "6xl",
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  maxWidth?: PageHeaderMaxWidth;
}) {
  return (
    <header className="border-b border-zinc-200/80 bg-white/90 shadow-[inset_0_-1px_0_0_rgba(15,23,42,0.06)] backdrop-blur-md">
      <div
        className={`mx-auto flex w-full ${maxWidths[maxWidth]} flex-wrap items-center justify-between gap-4 px-6 py-4`}
      >
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">{title}</h1>
          {description ? <p className="mt-0.5 text-sm leading-relaxed text-zinc-600">{description}</p> : null}
        </div>
        {children ? <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
      </div>
    </header>
  );
}
