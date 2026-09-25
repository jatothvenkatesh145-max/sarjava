import { createFileRoute, Link } from "@tanstack/react-router";

import { clearHistory, useHistory } from "@/lib/history-store";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Analysis history — JavaBench" },
      {
        name: "description",
        content:
          "Every Java file analyzed on this device, with date, status, error count and error type.",
      },
      { property: "og:title", content: "Analysis history — JavaBench" },
      {
        property: "og:description",
        content: "Reopen a previous Java analysis and read its faults again.",
      },
    ],
  }),
  component: History,
});

function History() {
  const { records } = useHistory();

  return (
    <section>
      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.22em] text-accent">History</p>
            <h1 className="text-2xl font-semibold tracking-tight">Previous analyses</h1>
          </div>
          {records.length > 0 ? (
            <button
              type="button"
              onClick={clearHistory}
              className="rounded-[8px] px-3 py-2 font-mono text-xs text-ink-soft ring-1 ring-ink/15 transition-colors hover:bg-ink/5"
            >
              Clear history
            </button>
          ) : null}
        </div>

        {records.length === 0 ? (
          <div className="mt-8 rounded-[12px] bg-card p-10 text-center ring-1 ring-black/5">
            <p className="text-sm text-ink-soft">
              No analyses stored yet. Run one in the{" "}
              <Link to="/analyzer" className="text-accent underline-offset-2 hover:underline">
                analyzer
              </Link>{" "}
              and it will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-[12px] bg-card ring-1 ring-black/5">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-line font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">File name</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Errors</th>
                  <th className="px-4 py-3 font-medium">Error type</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {records.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-secondary/60">
                    <td className="px-4 py-3 font-mono text-[12px] text-ink-soft">
                      {new Date(r.analyzedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-[13px]">{r.fileName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider ${
                          r.valid ? "bg-ok/10 text-ok" : "bg-accent/10 text-accent-deep"
                        }`}
                      >
                        {r.valid ? "valid" : "errors"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[13px]">{r.errorCount}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-ink-soft">
                      {r.errors[0]?.type ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to="/analyzer"
                        search={{ record: r.id, upload: undefined }}
                        className="font-mono text-[12px] text-accent"
                      >
                        View details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
