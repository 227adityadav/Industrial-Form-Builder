import type { ReactNode } from "react";

export default function ChataiLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-zinc-100">{children}</div>;
}
