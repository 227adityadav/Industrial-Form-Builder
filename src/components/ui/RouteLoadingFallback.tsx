/**
 * Inline-styled loading shell for Suspense fallbacks so the first paint does not
 * depend on the global Tailwind stylesheet having finished loading.
 */
export function RouteLoadingFallback({ variant = "light" }: { variant?: "light" | "dark" }) {
  const isDark = variant === "dark";
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      style={{
        minHeight: "100dvh",
        margin: 0,
        padding: "3rem 1.5rem",
        boxSizing: "border-box",
        background: isDark ? "#020617" : "#fafafa",
        color: isDark ? "#94a3b8" : "#52525b",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: "0.875rem",
        lineHeight: 1.5,
      }}
    >
      Loading…
    </div>
  );
}
