import type { RunResult } from "@/services/analyzerService";

interface OutputPanelProps {
  run: RunResult | null;
  running: boolean;
}

/** Dark console box showing real program output returned by the Java backend. */
export function OutputPanel({ run, running }: OutputPanelProps) {
  let body: React.ReactNode;
  let status = "";
  if (running) {
    body = <p className="text-code-dim">compiling and running in sandbox…</p>;
    status = "running";
  } else if (!run) {
    return null;
  } else if (run.status === "blocked") {
    status = "not executed";
    body = <p className="text-code-err">{run.message}</p>;
  } else if (run.status === "unavailable" || run.status === "failed") {
    status = "unavailable";
    body = <p className="text-amber">{run.message}</p>;
  } else {
    status = run.timedOut ? "timed out" : `exit ${run.exitCode ?? "?"}`;
    body = (
      <>
        {run.stdout ? (
          <pre className="whitespace-pre-wrap text-code-ink">{run.stdout}</pre>
        ) : !run.stderr ? (
          <p className="text-code-str">Program executed successfully with no console output.</p>
        ) : null}
        {run.stderr ? <pre className="mt-2 whitespace-pre-wrap text-code-err">{run.stderr}</pre> : null}
        {run.timedOut ? <p className="mt-2 text-amber">Execution stopped: time limit exceeded.</p> : null}
      </>
    );
  }

  return (
    <div className="mt-5">
      <h2 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-soft">Code Output</h2>
      <div className="overflow-hidden rounded-[12px] bg-code ring-1 ring-black/5">
        <div className="flex items-center justify-between border-b border-paper/10 px-4 py-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-code-dim">Program Output</span>
          <span className="font-mono text-[11px] text-code-dim">{status}</span>
        </div>
        <div className="min-h-[96px] p-4 font-mono text-[13px] leading-6">{body}</div>
      </div>
    </div>
  );
}
