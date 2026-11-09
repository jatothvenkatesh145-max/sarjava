import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { CodeSlab } from "@/components/CodeSlab";
import { ResultPanel } from "@/components/ResultPanel";
import { OutputPanel } from "@/components/OutputPanel";
import { GeminiExplanationPanel } from "@/components/GeminiExplanationPanel";
import { highlightCode } from "@/components/java-highlight";
import { analyzeCode, analyzeAndRun, simulate, type RunResult } from "@/services/analyzerService";
import { EXAMPLES, LANGS, langFromFile, type Lang } from "@/lib/languages";
import type { AnalysisResult } from "@/lib/java-analyzer";
import { saveAnalysis, useHistory } from "@/lib/history-store";

const MAX_FILE = 64 * 1024;

export const Route = createFileRoute("/analyzer")({
  validateSearch: (search: Record<string, unknown>): { upload?: boolean | undefined; record?: string | undefined } => ({
    upload: search["upload"] === true || search["upload"] === "true" ? true : undefined,
    record: typeof search["record"] === "string" ? search["record"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Analyzer — Java, Python & C | Smart Java Error Analyzer" },
      {
        name: "description",
        content: "Write or upload Java, Python or C, get real compiler errors explained in plain English, and run programs to see actual output.",
      },
      { property: "og:title", content: "Analyzer workspace — Smart Java Error Analyzer" },
      { property: "og:description", content: "Java, Python and C editor with real execution, error explanations and fixes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Analyzer,
});

type Tab = "editor" | "errors" | "output";

function Analyzer() {
  const { upload, record } = Route.useSearch();
  const { records } = useHistory();

  const [lang, setLang] = useState<Lang>("java");
  const [execMode, setExecMode] = useState<"real" | "simulated">("real");
  const [code, setCode] = useState(LANGS.java.sample);
  const [fileName, setFileName] = useState("Main.java");
  const [stdin, setStdin] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [run, setRun] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<"edit" | "inspect">("edit");
  const [tab, setTab] = useState<Tab>("editor");
  const [showFixes, setShowFixes] = useState(false);
  const [geminiTrigger, setGeminiTrigger] = useState(0);

  const fileRef = useRef<HTMLInputElement>(null);
  const fixesRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const openedUpload = useRef(false);
  const loadedRecord = useRef<string | null>(null);

  useEffect(() => {
    if (upload && !openedUpload.current) {
      openedUpload.current = true;
      fileRef.current?.click();
    }
  }, [upload]);

  useEffect(() => {
    if (!record || loadedRecord.current === record) return;
    const found = records.find((r) => r.id === record);
    if (found) {
      loadedRecord.current = record;
      setCode(found.source);
      setLang(found.language ?? "java");
      setFileName(found.fileName);
      setResult(found);
      setMode("inspect");
    }
  }, [record, records]);

  const lines = useMemo(() => code.split("\n"), [code]);
  const busy = loading || running;

  function guard(): boolean {
    if (!code.trim()) {
      setNotice({ tone: "error", text: "Add some source code before running." });
      return false;
    }
    setNotice(null);
    setActiveLine(null);
    return true;
  }

  function report(res: AnalysisResult) {
    setResult(res);
    setMode("inspect");
    saveAnalysis(res);
    const n = res.errors.filter((e) => e.severity === "error").length;
    const sim = execMode === "simulated" ? " (simulated heuristic check — not compiler-confirmed)" : "";
    setNotice(res.valid ? { tone: "ok", text: `No compilation/syntax errors${n ? ` — ${n} runtime error(s)` : ""}${sim}.` } : { tone: "error", text: `${n} error(s) found${sim}.` });
  }

  async function detect() {
    if (!guard()) return;
    if (execMode === "simulated") { report(simulate({ code, fileName, language: lang }).result); setTab("errors"); return; }
    setLoading(true);
    try {
      const analyzed = await analyzeCode({ code, fileName, stdin, language: lang });
      report(analyzed);
      if (lang === "java") setGeminiTrigger((current) => current + 1);
      setTab("errors");
    } catch {
      setNotice({ tone: "error", text: "Unable to reach the code execution service. Check your connection and try again." });
    } finally {
      setLoading(false);
    }
  }

  async function runProgram() {
    if (!guard()) return;
    if (execMode === "simulated") { const sres = simulate({ code, fileName, language: lang }); report(sres.result); setRun(sres.run); setTab("output"); return; }
    setRunning(true);
    setRun(null);
    try {
      const { result: res, run: r } = await analyzeAndRun({ code, fileName, stdin, language: lang });
      report(res);
      if (lang === "java") setGeminiTrigger((current) => current + 1);
      setRun(r);
      setTab(res.valid ? "output" : "errors");
    } catch (e) {
      setRun({ status: "failed", stdout: "", stderr: "", exitCode: null, timedOut: false, mode: "real", message: `Unable to run the code. The execution service could not be reached or rejected the request — ${e instanceof Error ? e.message : "please try again"}.` });
      setTab("output");
    } finally {
      setRunning(false);
    }
  }

  function fixSuggestions() {
    if (!result) {
      setNotice({ tone: "error", text: "Run “Detect Errors” first to get fix suggestions." });
      return;
    }
    if (result.valid) {
      setNotice({ tone: "ok", text: "No compilation errors — nothing to fix." });
      return;
    }
    setShowFixes(true);
    setTab("errors");
    setTimeout(() => fixesRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    const fl = langFromFile(file.name);
    if (!fl) {
      setNotice({ tone: "error", text: "Please upload a .java, .py or .c file." });
      return;
    }
    if (file.size > MAX_FILE) {
      setNotice({ tone: "error", text: "File is too large (max 64 KB)." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCode(String(reader.result ?? ""));
      setFileName(file.name);
      setLang(fl);
      setResult(null);
      setRun(null);
      setMode("edit");
      setTab("editor");
      setNotice({ tone: "ok", text: `${file.name} loaded into the editor.` });
    };
    reader.readAsText(file);
  }

  function loadExample(i: number) {
    const ex = EXAMPLES[lang][i];
    if (!ex) return;
    setCode(ex.code);
    setStdin(ex.stdin ?? "");
    setFileName(LANGS[lang].file);
    setResult(null);
    setRun(null);
    setShowFixes(false);
    setMode("edit");
    setTab("editor");
    setNotice(null);
  }

  function changeLang(l: Lang) {
    setLang(l);
    setCode(LANGS[l].sample);
    setFileName(LANGS[l].file);
    setStdin("");
    setResult(null);
    setRun(null);
    setShowFixes(false);
    setMode("edit");
    setTab("editor");
    setNotice(null);
  }

  function clearCode() {
    setCode("");
    setResult(null);
    setRun(null);
    setActiveLine(null);
    setShowFixes(false);
    setMode("edit");
    setNotice(null);
  }

  const btn = "rounded-[8px] px-3 py-2 font-mono text-xs text-ink-soft ring-1 ring-ink/15 transition-colors hover:bg-ink/5 disabled:opacity-60";
  const show = (t: Tab) => (tab === t ? "block" : "hidden lg:block");

  return (
    <section>
      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">Analyzer workspace</h1>
            <span className="font-mono text-[11px] text-ink-soft">{fileName}</span>
            <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">{execMode === "real" ? `${LANGS[lang].tool} sandbox` : "simulated"}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 font-mono text-[11px] text-ink-soft">
            Language
            <select aria-label="Programming language" value={lang} onChange={(e) => changeLang(e.target.value as Lang)} className="rounded-[8px] bg-paper px-2 py-2 font-mono text-xs text-ink ring-1 ring-ink/15">
              {(Object.keys(LANGS) as Lang[]).map((l) => <option key={l} value={l}>{LANGS[l].label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5 font-mono text-[11px] text-ink-soft">
            Mode
            <select aria-label="Execution mode" value={execMode} onChange={(e) => { setExecMode(e.target.value as "real" | "simulated"); setRun(null); setResult(null); }} className="rounded-[8px] bg-paper px-2 py-2 font-mono text-xs text-ink ring-1 ring-ink/15">
              <option value="real">Real execution</option>
              <option value="simulated">Simulated</option>
            </select>
          </label>
          <select
            aria-label="Load example program"
            value=""
            onChange={(e) => loadExample(Number(e.target.value))}
            className="rounded-[8px] bg-paper px-2 py-2 font-mono text-xs text-ink ring-1 ring-ink/15"
          >
            <option value="" disabled>Load example…</option>
            {EXAMPLES[lang].map((ex, i) => (
              <option key={ex.label} value={i}>{ex.label}</option>
            ))}
          </select>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={runProgram} disabled={busy} className="rounded-[8px] bg-ink px-4 py-2 font-mono text-xs font-medium text-paper disabled:opacity-60">
            {running ? "Running…" : "▶ Run Code"}
          </button>
          <button type="button" onClick={detect} disabled={busy} className="rounded-[8px] px-3 py-2 font-mono text-xs text-ink ring-1 ring-ink/25 transition-colors hover:bg-ink/5 disabled:opacity-60">
            {loading ? "Compiling…" : "Detect Errors"}
          </button>
          <button type="button" onClick={fixSuggestions} disabled={busy} className={btn}>Fix Suggestions</button>
          <button type="button" onClick={() => fileRef.current?.click()} className={btn}>Upload File</button>
          <button type="button" onClick={clearCode} className={btn}>Clear Code</button>
          <button type="button" onClick={() => setRun(null)} disabled={!run} className={btn}>Clear Output</button>
          <input ref={fileRef} type="file" accept=".java,.py,.c" className="hidden" onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />
        </div>

        {notice ? (
          <p className={`mb-4 rounded-[8px] px-3 py-2 font-mono text-xs ${notice.tone === "error" ? "bg-accent/10 text-accent-deep" : "bg-ok/10 text-ok"}`}>{notice.text}</p>
        ) : null}

        <div className="mb-4 flex gap-1 font-mono text-xs lg:hidden" role="tablist">
          {(["editor", "errors", "output"] as Tab[]).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded px-3 py-1.5 ${tab === t ? "bg-ink text-paper" : "text-ink-soft ring-1 ring-ink/15"}`}>
              {t === "editor" ? "Editor" : t === "errors" ? "Error Analysis" : "Output"}
            </button>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className={show("editor")}>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">{LANGS[lang].label} source</span>
              {result ? (
                <div className="flex gap-1 font-mono text-[11px]">
                  <button type="button" onClick={() => setMode("edit")} className={`rounded px-2 py-1 ${mode === "edit" ? "bg-ink text-paper" : "text-ink-soft"}`}>Edit</button>
                  <button type="button" onClick={() => setMode("inspect")} className={`rounded px-2 py-1 ${mode === "inspect" ? "bg-ink text-paper" : "text-ink-soft"}`}>Inspected</button>
                </div>
              ) : null}
            </div>

            {mode === "inspect" && result ? (
              <CodeSlab language={lang} code={result.source} issues={result.errors} activeLine={activeLine} onSelectLine={setActiveLine} />
            ) : (
              <div className="overflow-hidden rounded-[12px] bg-code ring-1 ring-black/5">
                <div className="flex items-center justify-between border-b border-paper/10 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-code-err" />
                    <span className="size-2.5 rounded-full bg-code-num" />
                    <span className="size-2.5 rounded-full bg-code-str" />
                  </div>
                  <span className="font-mono text-[11px] text-code-dim">editor · {fileName}</span>
                </div>
                <div className="flex h-[420px]">
                  <div ref={gutterRef} className="select-none overflow-hidden py-3 pr-3 text-right font-mono text-[13px] leading-6 text-code-dim">
                    {lines.map((_, i) => (
                      <div key={i} className="w-12">{i + 1}</div>
                    ))}
                  </div>
                  <div className="relative flex-1 overflow-hidden">
                    <pre ref={preRef} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre py-3 pr-4 font-mono text-[13px] leading-6 text-code-ink">
                      {lines.map((l, i) => (
                        <div key={i}>{l === "" ? " " : highlightCode(l, lang)}</div>
                      ))}
                    </pre>
                    <textarea
                      value={code}
                      spellCheck={false}
                      wrap="off"
                      onChange={(e) => setCode(e.target.value)}
                      onScroll={(e) => {
                        const t = e.currentTarget;
                        if (preRef.current) { preRef.current.scrollTop = t.scrollTop; preRef.current.scrollLeft = t.scrollLeft; }
                        if (gutterRef.current) gutterRef.current.scrollTop = t.scrollTop;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Tab") {
                          e.preventDefault();
                          const t = e.currentTarget;
                          const s = t.selectionStart;
                          const next = code.slice(0, s) + "    " + code.slice(t.selectionEnd);
                          setCode(next);
                          requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 4; });
                        }
                      }}
                      placeholder={`Write or paste ${LANGS[lang].label} code here…`}
                      className="absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent py-3 pr-4 font-mono text-[13px] leading-6 text-transparent caret-code-ink outline-none placeholder:text-code-dim"
                    />
                  </div>
                </div>
              </div>
            )}

            <label className="mt-3 block">
              <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">Program input (stdin — Scanner / input() / scanf)</span>
              <textarea
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                rows={2}
                placeholder="Values your program reads, one per line — e.g. 21"
                className="w-full rounded-[8px] bg-code p-2 font-mono text-[13px] text-code-ink outline-none ring-1 ring-black/5 placeholder:text-code-dim"
              />
            </label>
          </div>

          <div className={show("errors")}>
            <ResultPanel result={result} loading={loading || running} activeLine={activeLine} onSelectLine={setActiveLine} />
            <GeminiExplanationPanel result={result} mode={execMode} language={lang} trigger={geminiTrigger} />
          </div>
        </div>

        <div className={`mt-5 ${show("output")}`}>
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-soft">Code Output</h2>
          <OutputPanel run={run} running={running} onClear={() => setRun(null)} />
        </div>

        {result && !result.valid ? (
          <div ref={fixesRef} className={`mt-5 grid gap-5 md:grid-cols-2 ${showFixes ? "ring-2 ring-accent/40 rounded-[12px] p-1" : ""}`}>
            <CodeSlab code={result.source} issues={result.errors} language={lang} label="Original code" tone="before" />
            <CodeSlab code={result.correctedCode} language={lang} label="Suggested correction" tone="after" />
          </div>
        ) : null}
      </div>
    </section>
  );
}
