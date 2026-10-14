import { useState } from "react";
import type { RunResult } from "@/services/analyzerService";

interface OutputPanelProps {
  run: RunResult | null;
  running: boolean;
  onClear: () => void;
}

/** Dark console showing real program output returned by the Java sandbox. */
export function OutputPanel({ run, running, onClear }: OutputPanelProps) {
  const [copied, setCopied] = useState(false);
  let body: React.ReactNode;
  let status = "idle";
  if (running) {
    body = <p className="text-code-dim">compiling and running in sandbox…</p>;
    status = "running";
  } else if (!run) {
    body = <p className="text-code-dim">Click “Run Code” to compile and execute your program. Output appears here.</p>;
  } else if (run.status === "blocked") {
    status = run.statusText ?? "not executed";
    body = (
      <>
        <p className="text-code-err">{run.message}</p>
        {run.stderr ? <pre className="mt-2 whitespace-pre-wrap text-code-err/80">{run.stderr}</pre> : null}
      </>
    );
  } else if (run.status === "unavailable" || run.status === "failed") {
    status = "unavailable";
    body = <p className="text-amber">{run.message}</p>;
  } else {
    status = [run.statusText, run.exitCode != null ? `exit ${run.exitCode}` : null, run.time ? `${run.time}s` : null, run.memoryKb ? `${Math.round(run.memoryKb / 1024)} MB` : null]
      .filter(Boolean)
      .join(" · ");
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

  const copyText = run ? [run.stdout, run.stderr].filter(Boolean).join("\n") : "";

  return (
    <div className="overflow-hidden rounded-[12px] bg-code ring-1 ring-black/5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper/10 px-4 py-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-code-dim">Program Output</span>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-code-dim">{status}</span>
          <button
            type="button"
            disabled={!copyText}
            onClick={async () => {
              await navigator.clipboard.writeText(copyText);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
            className="font-mono text-[11px] text-code-ink hover:underline disabled:opacity-40"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            disabled={!run}
            onClick={onClear}
            className="font-mono text-[11px] text-code-ink hover:underline disabled:opacity-40"
          >
            Clear Output
          </button>
        </div>
      </div>
      <div className="min-h-[96px] p-4 font-mono text-[13px] leading-6">{body}</div>
    </div>
  );
}
