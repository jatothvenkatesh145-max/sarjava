import { createFileRoute, Link } from "@tanstack/react-router";

import { summarize, useHistory } from "@/lib/history-store";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Analysis dashboard — JavaBench" },
      {
        name: "description",
        content:
          "Totals for analyses run, errors detected, valid programs and the most common Java error type.",
      },
      { property: "og:title", content: "Analysis dashboard — JavaBench" },
      {
        property: "og:description",
        content: "Track how many Java files you analyzed and which faults recur most.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { records } = useHistory();
  const stats = summarize(records);
  const max = stats.typeCounts[0]?.count ?? 1;

  return (
    <section>
      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.22em] text-accent">Dashboard</p>
        <h1 className="text-2xl font-semibold tracking-tight">Analysis overview</h1>

        <div className="mt-8 grid gap-px overflow-hidden rounded-[12px] bg-line ring-1 ring-black/5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total analyses", value: stats.total },
            { label: "Errors detected", value: stats.totalErrors },
            { label: "Valid programs", value: stats.valid },
            { label: "Files with errors", value: stats.withErrors },
          ].map((card) => (
            <div key={card.label} className="bg-paper p-5">
              <p className="font-mono text-3xl font-semibold leading-none">{card.value}</p>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                {card.label}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="rounded-[12px] bg-card p-5 ring-1 ring-black/5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Most common error type</h2>
              <span className="font-mono text-[11px] text-ink-soft">{stats.commonType}</span>
            </div>
            {stats.typeCounts.length === 0 ? (
              <p className="mt-4 text-sm text-ink-soft">
                No analyses yet. Run one in the{" "}
                <Link to="/analyzer" className="text-accent underline-offset-2 hover:underline">
                  analyzer
                </Link>
                .
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {stats.typeCounts.map((t) => (
                  <li key={t.type}>
                    <div className="flex items-center justify-between font-mono text-[11px] text-ink-soft">
                      <span>{t.type}</span>
                      <span>{t.count}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-secondary">
                      <div
                        className="h-2 rounded-full bg-accent"
                        style={{ width: `${Math.round((t.count / max) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-[12px] bg-card p-5 ring-1 ring-black/5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Recent analyses</h2>
              <Link to="/history" className="font-mono text-[11px] text-accent">
                View history →
              </Link>
            </div>
            {records.length === 0 ? (
              <p className="mt-4 text-sm text-ink-soft">Nothing analyzed on this device yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {records.slice(0, 6).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[13px]">{r.fileName}</p>
                      <p className="font-mono text-[11px] text-ink-soft">
                        {new Date(r.analyzedAt).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider ${
                        r.valid ? "bg-ok/10 text-ok" : "bg-accent/10 text-accent-deep"
                      }`}
                    >
                      {r.valid ? "valid" : `${r.errorCount} errors`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
