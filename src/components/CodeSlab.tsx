import { highlightCode } from "@/components/java-highlight";
import type { Lang } from "@/lib/languages";
import type { AnalysisIssue } from "@/lib/java-analyzer";

interface CodeSlabProps {
  code: string;
  issues?: AnalysisIssue[];
  activeLine?: number | null;
  onSelectLine?: (line: number) => void;
  label?: string;
  tone?: "neutral" | "before" | "after";
  language?: Lang | undefined;
}

/** Read-only dark code listing with line numbers and margin fault markers. */
export function CodeSlab({
  code,
  issues = [],
  activeLine = null,
  onSelectLine,
  label,
  tone = "neutral",
  language = "java",
}: CodeSlabProps) {
  const lines = code.replace(/\r\n/g, "\n").split("\n");
  const byLine = new Map<number, AnalysisIssue>();
  for (const issue of issues) {
    if (!byLine.has(issue.line) || issue.severity === "error") byLine.set(issue.line, issue);
  }

  return (
    <div className="overflow-hidden rounded-[10px] bg-code ring-1 ring-black/5">
      {label ? (
        <div className="flex items-center justify-between border-b border-paper/10 px-4 py-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-code-dim">
            {label}
          </span>
          <span
            className={`font-mono text-[11px] ${tone === "after" ? "text-code-str" : tone === "before" ? "text-code-err" : "text-code-dim"}`}
          >
            {tone === "after"
              ? "corrected"
              : tone === "before"
                ? `${issues.filter((i) => i.severity === "error").length} faults`
                : `${lines.length} lines`}
          </span>
        </div>
      ) : null}
      <div className="overflow-x-auto font-mono text-[13px] leading-6">
        {lines.map((line, i) => {
          const no = i + 1;
          const issue = byLine.get(no);
          const isActive = activeLine === no;
          const bg = issue
            ? issue.severity === "error"
              ? "bg-accent/10 hover:bg-accent/20"
              : "bg-amber/10 hover:bg-amber/20"
            : "hover:bg-paper/5";
          return (
            <button
              key={no}
              type="button"
              disabled={!issue || !onSelectLine}
              onClick={() => issue && onSelectLine?.(no)}
              className={`flex w-full text-left transition-colors ${bg} ${isActive ? "ring-1 ring-inset ring-accent" : ""} ${issue && onSelectLine ? "cursor-pointer" : "cursor-default"}`}
            >
              <span
                className={`w-12 shrink-0 select-none pr-3 text-right ${
                  issue
                    ? issue.severity === "error"
                      ? "font-bold text-accent"
                      : "font-bold text-amber"
                    : "text-code-dim"
                }`}
              >
                {no}
              </span>
              <code
                className={`whitespace-pre pr-4 ${issue?.severity === "error" ? "text-code-err" : issue ? "text-amber" : "text-code-ink"}`}
              >
                {line === "" ? " " : highlightCode(line, language)}
              </code>
            </button>
          );
        })}
      </div>
    </div>
  );
}
