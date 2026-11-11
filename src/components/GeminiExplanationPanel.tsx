import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { explainJavaDiagnostics } from "@/lib/gemini.functions";
import type { AnalysisResult } from "@/lib/java-analyzer";
import type { GeminiCommentary } from "@/lib/gemini.server";

interface GeminiExplanationPanelProps {
  result: AnalysisResult | null;
  analysisOrigin: "compiler" | "simulated" | "unknown";
  language: string;
  currentSource: string;
  trigger: number;
}

const ERROR_COPY: Record<string, string> = {
  not_configured: "Gemini is not configured yet. Add GEMINI_API_KEY in the secure project settings.",
  rate_limited: "AI explanations are temporarily limited. Please wait a minute and try again.",
  provider_rejected: "Gemini could not accept this request. Check the key's access and try again.",
  timeout: "Gemini took too long to respond. Your compiler results are still available; try again.",
  unavailable: "Gemini is temporarily unavailable. Your compiler results are still available; try again.",
};

export function GeminiExplanationPanel({ result, analysisOrigin, language, currentSource, trigger }: GeminiExplanationPanelProps) {
  const explainJava = useServerFn(explainJavaDiagnostics);
  const [commentary, setCommentary] = useState<GeminiCommentary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const pendingRequest = useRef<{ key: string; promise: ReturnType<typeof explainJava> } | null>(null);

  useEffect(() => {
    setCommentary(null);
    setError(null);
    setLoading(false);
  }, [result, analysisOrigin, language, currentSource]);

  useEffect(() => {
    if (trigger > 0) setAttempt((current) => current + 1);
  }, [trigger]);

  useEffect(() => {
    if (trigger === 0 && attempt === 0) return;
    if (!result || language !== "java" || analysisOrigin !== "compiler" || result.source !== currentSource) return;
    let active = true;
    setLoading(true);
    setError(null);
    setCommentary(null);

    const requestKey = `${trigger}:${attempt}:${result.analyzedAt}`;
    let request = pendingRequest.current?.key === requestKey ? pendingRequest.current.promise : null;
    if (!request) {
      request = explainJava({
        data: {
          source: result.source,
          diagnostics: result.errors.slice(0, 20).map(({ line, type, severity, message, explanation, suggestion, originalLine }) => ({
          line, type, severity, message, explanation, suggestion, originalLine,
          })),
        },
      });
      pendingRequest.current = { key: requestKey, promise: request };
    }

    void request.then((response) => {
      if (!active) return;
      if (response.ok) setCommentary(response.commentary);
      else setError(ERROR_COPY[response.reason] ?? ERROR_COPY["unavailable"] ?? "Gemini is temporarily unavailable.");
    }).catch(() => {
      if (active) setError(ERROR_COPY["unavailable"] ?? "Gemini is temporarily unavailable.");
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [attempt, trigger, result, analysisOrigin, language, currentSource, explainJava]);

  if (language !== "java") return null;

  const canExplain = Boolean(result && analysisOrigin === "compiler" && result.source === currentSource);
  return (
    <section aria-labelledby="gemini-explanation-title" className="mt-4 overflow-hidden rounded-[12px] bg-card ring-1 ring-black/5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 id="gemini-explanation-title" className="font-mono text-[11px] uppercase tracking-wider text-ink">AI commentary · Gemini</h2>
          <p className="mt-1 text-xs text-ink-soft">Learning suggestions only · Judge0 remains the source of compiler results</p>
          <p className="mt-1 text-xs text-ink-soft">Java source and diagnostics are sent to Google when AI commentary is generated.</p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={!canExplain || loading} onClick={() => setAttempt((current) => current + 1)}>
          {loading ? "Thinking…" : commentary ? "Ask again" : "Explain with Gemini"}
        </Button>
      </header>

      <div aria-live="polite" className="space-y-4 p-4">
        {!result ? <p className="text-sm text-ink-soft">Run Detect Errors to get separate AI explanations for your Java diagnostics.</p> : null}
        {result && analysisOrigin === "simulated" ? <p className="text-sm text-ink-soft">AI explanations are available for compiler-confirmed Java analysis, not simulated results.</p> : null}
        {result && analysisOrigin === "unknown" ? <p className="text-sm text-ink-soft">Run a new real Java analysis to request AI commentary. Saved history may not record whether it came from real or simulated mode.</p> : null}
        {result && analysisOrigin === "compiler" && result.source !== currentSource ? <p className="text-sm text-ink-soft">The editor has changed since this analysis. Run Detect Errors again to refresh the AI commentary.</p> : null}
        {loading ? <p className="text-sm text-ink-soft">Gemini is reviewing the Java diagnostics…</p> : null}
        {error ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="alert" className="text-sm text-accent-deep">{error}</p>
            <Button type="button" variant="outline" size="sm" disabled={!canExplain || loading} onClick={() => setAttempt((current) => current + 1)}>Try again</Button>
          </div>
        ) : null}
        {commentary && result ? (
          <>
            <p className="text-sm leading-6 text-ink">{commentary.summary}</p>
            {commentary.diagnostics.length ? (
              <div className="space-y-3">
                {commentary.diagnostics.map((item) => (
                  <article key={`${item.line}-${item.explanation}`} className="border-l-2 border-accent pl-3">
                    <p className="font-mono text-[11px] uppercase text-ink-soft">Line {item.line}</p>
                    <p className="mt-1 text-sm text-ink-soft">{item.explanation}</p>
                    <p className="mt-1 text-sm"><span className="font-medium text-ink">Suggested fix: </span>{item.correction}</p>
                  </article>
                ))}
              </div>
            ) : null}
            {commentary.improvements.length ? (
              <div>
                <h3 className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Code improvement suggestions</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
                  {commentary.improvements.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
                </ul>
              </div>
            ) : null}
            {result.errors.length > 0 && commentary.correctedCode ? (
              <div>
                <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-soft">Gemini’s suggested complete code</h3>
                <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-[8px] bg-code p-3 font-mono text-xs leading-5 text-code-ink">{commentary.correctedCode}</pre>
              </div>
            ) : null}
            <p className="border-t border-line pt-3 font-mono text-[10px] uppercase tracking-wider text-amber">AI-generated advice · review before using</p>
          </>
        ) : null}
      </div>
    </section>
  );
}