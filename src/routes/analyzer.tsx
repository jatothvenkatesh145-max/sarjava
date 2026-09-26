import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { CodeSlab } from "@/components/CodeSlab";
import { ResultPanel } from "@/components/ResultPanel";
import { analyzeCode, ANALYZER_MODE } from "@/services/analyzerService";
import type { AnalysisResult } from "@/lib/java-analyzer";
import { saveAnalysis, useHistory } from "@/lib/history-store";

const SAMPLE = `public class Test {
    public static void main(String[] args) {
        int number = 10;
        System.out.println(number);
    }
}`;

export const Route = createFileRoute("/analyzer")({
  validateSearch: (search: Record<string, unknown>): { upload?: boolean | undefined; record?: string | undefined } => ({
    upload: search['upload'] === true || search['upload'] === "true" ? true : undefined,
    record: typeof search['record'] === "string" ? search['record'] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Analyzer workspace — Smart Java Error Analyzer" },
      {
        name: "description",
        content:
          "Paste or upload Java source and get line-accurate errors, plain-language explanations and suggested corrections.",
      },
      { property: "og:title", content: "Analyzer workspace — Smart Java Error Analyzer" },
      {
        property: "og:description",
        content: "The Smart Java Error Analyzer editor and analysis result panel for Java source files.",
      },
    ],
  }),
  component: Analyzer,
});

function Analyzer() {
  const { upload, record } = Route.useSearch();
  const { records } = useHistory();

  const [code, setCode] = useState(SAMPLE);
  const [fileName, setFileName] = useState("Test.java");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [mode, setMode] = useState<"edit" | "inspect">("edit");

  const fileRef = useRef<HTMLInputElement>(null);
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
      setFileName(found.fileName);
      setResult(found);
      setMode("inspect");
    }
  }, [record, records]);

  const lineNumbers = useMemo(
    () => Array.from({ length: code.split("\n").length }, (_, i) => i + 1),
    [code],
  );

  async function runAnalysis() {
    if (!code.trim()) {
      setNotice({ tone: "error", text: "Add some Java source before running the analysis." });
      return;
    }
    setNotice(null);
    setLoading(true);
    setActiveLine(null);
    try {
      const res = await analyzeCode({ code, fileName });
      setResult(res);
      setMode("inspect");
      saveAnalysis(res);
      setNotice(
        res.valid
          ? { tone: "ok", text: "Analysis complete — no errors found." }
          : {
              tone: "error",
              text: `Analysis complete — ${res.errors.filter((e) => e.severity === "error").length} error(s) found.`,
            },
      );
    } catch {
      setResult(null);
      setNotice({
        tone: "error",
        text: "Unable to analyze the code. Please check the backend connection.",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".java")) {
      setNotice({ tone: "error", text: "Please upload a valid Java (.java) file." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCode(String(reader.result ?? ""));
      setFileName(file.name);
      setResult(null);
      setMode("edit");
      setNotice({ tone: "ok", text: `${file.name} loaded into the editor.` });
    };
    reader.readAsText(file);
  }

  function clearCode() {
    setCode("");
    setResult(null);
    setActiveLine(null);
    setMode("edit");
    setNotice(null);
  }

  return (
    <section>
      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">Analyzer workspace</h1>
            <span className="font-mono text-[11px] text-ink-soft">{fileName}</span>
            <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
              {ANALYZER_MODE === "mock" ? "demo analyzer" : "java backend"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={clearCode}
              className="rounded-[8px] px-3 py-2 font-mono text-xs text-ink-soft ring-1 ring-ink/15 transition-colors hover:bg-ink/5"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-[8px] px-3 py-2 font-mono text-xs text-ink-soft ring-1 ring-ink/15 transition-colors hover:bg-ink/5"
            >
              Upload .java
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".java"
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={runAnalysis}
              disabled={loading}
              className="rounded-[8px] bg-ink px-3.5 py-2 font-mono text-xs font-medium text-paper disabled:opacity-60"
            >
              {loading ? "Analyzing Java code..." : "Analyze code"}
            </button>
          </div>
        </div>

        {notice ? (
          <p
            className={`mb-4 rounded-[8px] px-3 py-2 font-mono text-xs ${
              notice.tone === "error"
                ? "bg-accent/10 text-accent-deep"
                : "bg-ok/10 text-ok"
            }`}
          >
            {notice.text}
          </p>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                Java source
              </span>
              {result ? (
                <div className="flex gap-1 font-mono text-[11px]">
                  <button
                    type="button"
                    onClick={() => setMode("edit")}
                    className={`rounded px-2 py-1 ${mode === "edit" ? "bg-ink text-paper" : "text-ink-soft"}`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("inspect")}
                    className={`rounded px-2 py-1 ${mode === "inspect" ? "bg-ink text-paper" : "text-ink-soft"}`}
                  >
                    Inspected
                  </button>
                </div>
              ) : null}
            </div>

            {mode === "inspect" && result ? (
              <CodeSlab
                code={result.source}
                issues={result.errors}
                activeLine={activeLine}
                onSelectLine={setActiveLine}
              />
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
                <div className="flex">
                  <div className="select-none py-3 pr-3 text-right font-mono text-[13px] leading-6 text-code-dim">
                    {lineNumbers.map((n) => (
                      <div key={n} className="w-12">
                        {n}
                      </div>
                    ))}
                  </div>
                  <textarea
                    value={code}
                    spellCheck={false}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={SAMPLE}
                    className="min-h-[420px] w-full resize-y bg-transparent py-3 pr-4 font-mono text-[13px] leading-6 text-code-ink outline-none placeholder:text-code-dim"
                  />
                </div>
              </div>
            )}
          </div>

          <ResultPanel
            result={result}
            loading={loading}
            activeLine={activeLine}
            onSelectLine={setActiveLine}
          />
        </div>

        {result && !result.valid ? (
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <CodeSlab code={result.source} issues={result.errors} label="Original code" tone="before" />
            <CodeSlab code={result.correctedCode} label="Suggested correction" tone="after" />
          </div>
        ) : null}
      </div>
    </section>
  );
}
