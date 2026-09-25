import type { AnalysisResult } from "@/lib/java-analyzer";

interface ResultPanelProps {
  result: AnalysisResult | null;
  loading: boolean;
  activeLine: number | null;
  onSelectLine: (line: number) => void;
}

export function ResultPanel({ result, loading, activeLine, onSelectLine }: ResultPanelProps) {
  if (loading) {
    return (
      <div className="overflow-hidden rounded-[12px] bg-card ring-1 ring-black/5">
        <div className="border-b border-line px-4 py-3 font-mono text-[11px] text-ink-soft">
          inspecting source…
        </div>
        <div className="space-y-3 p-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-[10px] bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[12px] bg-card p-8 text-center ring-1 ring-black/5">
        <span className="font-mono text-xs uppercase tracking-[0.22em] text-accent">
          Analysis result
        </span>
        <p className="mt-3 max-w-[38ch] text-sm text-ink-soft text-pretty">
          Paste Java source or upload a <span className="font-mono">.java</span> file, then run the
          analysis. Faults appear here with the line, the reason and a suggested correction.
        </p>
      </div>
    );
  }

  const errors = result.errors.filter((e) => e.severity === "error");
  const warnings = result.errors.filter((e) => e.severity === "warning");

  return (
    <div className="overflow-hidden rounded-[12px] bg-card ring-1 ring-black/5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {errors.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded bg-accent/10 px-2 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-accent-deep">
              <span className="pulse-once size-1.5 rounded-full bg-accent" /> {errors.length} error
              {errors.length > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded bg-ok/10 px-2 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-ok">
              <span className="size-1.5 rounded-full bg-ok" /> no error found
            </span>
          )}
          {warnings.length > 0 ? (
            <span className="rounded bg-amber/10 px-2 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-amber">
              {warnings.length} warning{warnings.length > 1 ? "s" : ""}
            </span>
          ) : null}
          <span className="font-mono text-[11px] text-ink-soft">{result.fileName}</span>
        </div>
        <span className="font-mono text-[11px] text-ink-soft">
          {result.lineCount} lines · {(result.durationMs / 1000).toFixed(1)}s
        </span>
      </div>

      {result.valid && warnings.length === 0 ? (
        <div className="p-6">
          <p className="font-mono text-sm font-semibold text-ok">✓ NO ERROR FOUND</p>
          <p className="mt-2 text-sm text-ink-soft">The Java code passed the analysis.</p>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-ink-soft">Status</p>
          <p className="font-mono text-sm">Valid Java Code</p>
        </div>
      ) : (
        <div className="max-h-[560px] space-y-3 overflow-y-auto p-4">
          {result.errors.map((issue, index) => {
            const isError = issue.severity === "error";
            return (
              <button
                key={issue.id}
                type="button"
                onClick={() => onSelectLine(issue.line)}
                style={{ animationDelay: `${index * 0.07}s` }}
                className={`rise block w-full rounded-[10px] p-4 text-left ring-1 transition-colors ${
                  activeLine === issue.line
                    ? "ring-accent"
                    : "ring-black/5 hover:bg-secondary/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider ${
                      isError ? "bg-accent/10 text-accent-deep" : "bg-amber/10 text-amber"
                    }`}
                  >
                    {issue.type}
                  </span>
                  <span className="font-mono text-[11px] text-ink-soft">line {issue.line}</span>
                </div>
                <p className="mt-3 text-sm font-medium">{issue.message}</p>
                <p className="mt-2 text-[13px] text-ink-soft text-pretty">
                  <span className="font-medium text-ink">Why did this happen? </span>
                  {issue.explanation}
                </p>
                <p className="mt-2 text-[13px] text-ink-soft text-pretty">
                  <span className="font-medium text-ink">How to fix it: </span>
                  {issue.suggestion}
                </p>
                {issue.correctedLine ? (
                  <div className="mt-3 rounded-[8px] bg-code p-3 font-mono text-[12px] leading-5">
                    <p className="text-code-dim">// suggested correction</p>
                    <p className="whitespace-pre-wrap text-code-ink">
                      {issue.correctedLine.trim()}
                    </p>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
