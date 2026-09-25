import { Link } from "@tanstack/react-router";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/analyzer", label: "Analyzer" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/history", label: "History" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/about", label: "About" },
] as const;

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-8 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-[8px] bg-ink font-mono text-xs font-bold text-paper">
            JB
          </span>
          <span className="text-[15px] font-semibold tracking-tight">JavaBench</span>
          <span className="ml-1 rounded border border-line px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
            v0.4
          </span>
        </Link>
        <nav className="hidden items-center gap-6 overflow-x-auto text-sm text-ink-soft md:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              activeProps={{ className: "text-ink font-medium" }}
              className="whitespace-nowrap transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-1.5 font-mono text-xs text-ink-soft sm:flex">
            <span className="size-1.5 rounded-full bg-accent" /> static analysis only
          </span>
          <Link
            to="/analyzer"
            className="rounded-[8px] bg-ink px-3.5 py-2 text-sm font-medium text-paper"
          >
            Open analyzer
          </Link>
        </div>
      </div>
      <nav className="flex gap-4 overflow-x-auto border-t border-line px-4 py-2 text-sm text-ink-soft md:hidden">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === "/" }}
            activeProps={{ className: "text-ink font-medium" }}
            className="whitespace-nowrap"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-ink text-paper">
      <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-4 px-4 py-8 sm:flex-row sm:items-center sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-6 place-items-center rounded-[6px] bg-paper font-mono text-[10px] font-bold text-ink">
            JB
          </span>
          <span className="font-semibold tracking-tight">JavaBench</span>
        </div>
        <p className="font-mono text-[11px] text-paper/50">
          Educational static analysis · not a Java compiler · 2026
        </p>
      </div>
    </footer>
  );
}
