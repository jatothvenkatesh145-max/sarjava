import { useState } from "react";
import type { RunResult } from "@/services/analyzerService";

interface OutputPanelProps {
  run: RunResult | null;
  running: boolean;
  onClear: () => void;
}

function Section({ title, tone, text }: { title: string; tone: string; text: string }) {
  return (
    <div className="border-t border-paper/10 first:border-t-0 px-4 py-3">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-code-dim">{title}</p>
      <pre className={`whitespace-pre-wrap font-mono text-[13px] leading-6 ${tone}`}>{text}</pre>
    </div>
  );
}

/** Console showing real sandbox output (or clearly labeled simulated output). */
export function OutputPanel({ run, running, onClear }: OutputPanelProps) {
  const [copied, setCopied] = useState(false);
  const simulated = run?.mode === "simulated";
  const stats = run
    ? [run.statusText, run.exitCode != null ? `exit ${run.exitCode}` : null, run.time ? `${run.time}s` : null, run.memoryKb ? `${Math.round(run.memoryKb / 1024)} MB` : null].filter(Boolean).join(" · ")
    : "";
  const copyText = run ? [run.stdout, run.stderr, run.compileOutput].filter(Boolean).join("\n") : "";

  return (
    <div className="overflow-hidden rounded-[12px] bg-code ring-1 ring-black/5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper/10 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-code-dim">Program Output</span>
          {run ? (
            <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider ${simulated ? "bg-amber/20 text-amber" : "bg-ok/20 text-code-str"}`}>
              {simulated ? "SIMULATED OUTPUT — NOT ACTUAL EXECUTION" : "ACTUAL EXECUTION"}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <button type="button" disabled={!copyText} onClick={async () => { await navigator.clipboard.writeText(copyText); setCopied(true); setTimeout(() => setCopied(false), 1200); }} className="font-mono text-[11px] text-code-ink hover:underline disabled:opacity-40">
            {copied ? "Copied" : "Copy Output"}
          </button>
          <button type="button" disabled={!run} onClick={onClear} className="font-mono text-[11px] text-code-ink hover:underline disabled:opacity-40">Clear Output</button>
        </div>
      </div>
      {running ? (
        <p className="min-h-[96px] p-4 font-mono text-[13px] text-code-dim">compiling and running in sandbox…</p>
      ) : !run ? (
        <p className="min-h-[96px] p-4 font-mono text-[13px] text-code-dim">Click “Run Code” to execute your program. Output appears here.</p>
      ) : (
        <div>
          <Section title="Execution status" tone={run.status === "ok" ? "text-code-str" : "text-amber"} text={[stats || (simulated ? "not executed" : run.status), run.message, run.timedOut ? "Execution stopped: time limit exceeded." : null].filter(Boolean).join("\n")} />
          {run.compileOutput ? <Section title="Compilation errors" tone="text-code-err" text={run.compileOutput} /> : null}
          {run.status === "ok" || run.stdout ? (
            <Section title="Standard output" tone="text-code-ink" text={run.stdout || (simulated ? "(none)" : run.statusText === "Accepted" ? "Program executed successfully with no console output." : "(no output)")} />
          ) : null}
          {run.stderr ? <Section title="Standard error" tone="text-code-err" text={run.stderr} /> : null}
        </div>
      )}
    </div>
  );
}
