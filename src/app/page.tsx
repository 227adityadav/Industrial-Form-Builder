function RoleIconAdmin() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
      />
    </svg>
  );
}

function RoleIconUser() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
      />
    </svg>
  );
}

function RoleIconManager() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"
      />
    </svg>
  );
}

function RoleIconDashboard() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6A2.25 2.25 0 0 1 6 3.75h3.879a2.25 2.25 0 0 1 1.59.659l2.122 2.12a2.25 2.25 0 0 0 1.59.659H18A2.25 2.25 0 0 1 20.25 9v8.25A2.25 2.25 0 0 1 18 19.5H6A2.25 2.25 0 0 1 3.75 17.25V6Z"
      />
    </svg>
  );
}

function RoleIconSpc() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v3.75C7.5 17.496 6.996 18 6.375 18h-2.25A1.125 1.125 0 0 1 3 16.875v-3.75ZM10.5 6.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v13.5c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125v-13.5ZM18.75 8.625c0-.621.504-1.125 1.125-1.125h2.25C22.496 7.5 23 8.004 23 8.625v8.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125v-8.25Z"
      />
    </svg>
  );
}

const roles = [
  {
    href: "/admin/login",
    title: "Admin",
    description: "Design templates, manage folders and users.",
    icon: RoleIconAdmin,
    ring: "ring-amber-500/25",
    iconBg: "bg-amber-100 text-amber-800",
  },
  {
    href: "/login",
    title: "Operator",
    description: "Open assigned folders and enter line data.",
    icon: RoleIconUser,
    ring: "ring-emerald-500/25",
    iconBg: "bg-emerald-100 text-emerald-800",
  },
  {
    href: "/manager/login",
    title: "Manager",
    description: "Review submissions by folder and user.",
    icon: RoleIconManager,
    ring: "ring-violet-500/25",
    iconBg: "bg-violet-100 text-violet-800",
  },
  {
    href: "/dashboard/login",
    title: "Dashboard",
    description: "Read-only overview of master and site folders, with PDF export.",
    icon: RoleIconDashboard,
    ring: "ring-cyan-500/25",
    iconBg: "bg-cyan-100 text-cyan-900",
  },
  {
    href: "/spc/login",
    title: "SPC",
    description: "Process capability study: X̄–R, Cp/Cpk, and audit-ready CSV or PDF export.",
    icon: RoleIconSpc,
    ring: "ring-orange-500/25",
    iconBg: "bg-orange-100 text-orange-900",
  },
] as const;

export default function Home() {
  return (
    <div className="app-page">
      <div
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.03)_1px,transparent_1px)] bg-[size:48px_48px]"
        aria-hidden
      />
      <main className="relative mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-12 px-6 py-16 sm:py-20">
        <header className="max-w-2xl">
          <p className="ui-section-title text-emerald-800/90">Shop-floor ready</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
            Industrial Form Builder
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-zinc-600">
            Nested column headers, spreadsheet-style grids, and role-based access—built for quality and production
            teams.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {roles.map((r) => {
            const Icon = r.icon;
            return (
              <a
                key={r.href}
                href={r.href}
                className={`group relative flex flex-col rounded-2xl border border-zinc-200/80 bg-white/90 p-6 shadow-sm ring-1 ${r.ring} transition-all hover:-translate-y-0.5 hover:border-zinc-300/90 hover:shadow-md hover:shadow-zinc-950/10`}
              >
                <div
                  className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${r.iconBg} transition-transform group-hover:scale-105`}
                >
                  <Icon />
                </div>
                <div className="text-base font-semibold text-zinc-900">{r.title}</div>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{r.description}</p>
                <span className="mt-4 text-sm font-medium text-emerald-800 group-hover:underline">
                  Continue →
                </span>
              </a>
            );
          })}
        </div>
      </main>
    </div>
  );
}
