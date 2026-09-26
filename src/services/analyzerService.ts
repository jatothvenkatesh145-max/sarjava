/**
 * Analyzer service layer.
 *
 * The UI only ever talks to `analyzeCode()`. Two implementations exist:
 *
 *   MOCK    – heuristic browser-side static analysis (src/lib/java-analyzer.ts).
 *             Development only; used while no Java backend is connected.
 *   REMOTE  – POST {VITE_ANALYZER_API}/api/analyze  { code }  ->  { valid, errors[] }
 *             served by the real Java backend (javac / Java analysis engine).
 *
 * Setting VITE_ANALYZER_API switches to REMOTE. In REMOTE mode failures are
 * surfaced to the user — we never silently fall back to the mock.
 */

import { analyzeJava, type AnalysisIssue, type AnalysisResult } from "@/lib/java-analyzer";

export type AnalyzerMode = "mock" | "remote";

const API_BASE = (import.meta.env['VITE_ANALYZER_API'] as string | undefined)?.replace(/\/$/, "");

export const ANALYZER_MODE: AnalyzerMode = API_BASE ? "remote" : "mock";

export interface AnalyzeRequest {
  code: string;
  fileName?: string;
}

export class AnalyzerConnectionError extends Error {}

interface RemoteIssue {
  line?: number;
  type?: string;
  severity?: "error" | "warning";
  message?: string;
  explanation?: string;
  suggestion?: string;
  correctedLine?: string;
}

interface RemoteResponse {
  valid?: boolean;
  errors?: RemoteIssue[];
  correctedCode?: string;
}

function normalize(raw: RemoteResponse, code: string, fileName: string, started: number): AnalysisResult {
  if (typeof raw !== "object" || raw === null || !Array.isArray(raw.errors ?? [])) {
    throw new AnalyzerConnectionError("Malformed response from analyzer backend");
  }
  const lines = code.split("\n");
  const errors: AnalysisIssue[] = (raw.errors ?? []).map((e, i) => {
    const line = Math.max(1, Math.min(lines.length, Number(e.line) || 1));
    return {
      id: `remote-${i}`,
      line,
      type: e.type ?? "Compilation Error",
      severity: e.severity ?? "error",
      message: e.message ?? "Unknown error",
      explanation: e.explanation ?? "",
      suggestion: e.suggestion ?? "",
      originalLine: lines[line - 1] ?? "",
      ...(e.correctedLine ? { correctedLine: e.correctedLine } : {}),
    };
  });
  const hasErrors = errors.some((e) => e.severity === "error");
  return {
    success: true,
    valid: raw.valid ?? !hasErrors,
    fileName,
    source: code,
    correctedCode: raw.correctedCode ?? code,
    lineCount: lines.length,
    durationMs: Date.now() - started,
    analyzedAt: new Date().toISOString(),
    errors,
  };
}

async function analyzeRemote({ code, fileName = "Main.java" }: AnalyzeRequest): Promise<AnalysisResult> {
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, fileName }),
    });
  } catch {
    throw new AnalyzerConnectionError("Java backend unreachable");
  }
  if (!res.ok) throw new AnalyzerConnectionError(`Analyzer backend responded with ${res.status}`);
  return normalize((await res.json()) as RemoteResponse, code, fileName, started);
}

async function analyzeMock({ code, fileName }: AnalyzeRequest): Promise<AnalysisResult> {
  await new Promise((r) => setTimeout(r, 450));
  return analyzeJava(code, fileName ?? "Main.java");
}

export async function analyzeCode(req: AnalyzeRequest): Promise<AnalysisResult> {
  return ANALYZER_MODE === "remote" ? analyzeRemote(req) : analyzeMock(req);
}

export type { AnalysisResult };

/* ------------------------------------------------------------------ */
/* Execution                                                           */
/*                                                                     */
/* Java is NEVER executed in the browser and output is NEVER simulated. */
/* Execution is delegated to the Java backend:                         */
/*   POST {VITE_ANALYZER_API}/api/run { code, fileName }                */
/*     -> { stdout, stderr?, exitCode?, timedOut? }                     */
/* The backend must compile + run inside an isolated sandbox           */
/* (container / no network / CPU, memory and time limits).             */
/* ------------------------------------------------------------------ */

export interface RunResult {
  status: "ok" | "blocked" | "unavailable" | "failed";
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  message?: string;
}

export async function runCode({ code, fileName = "Main.java" }: AnalyzeRequest): Promise<RunResult> {
  const empty = { stdout: "", stderr: "", exitCode: null, timedOut: false };
  if (ANALYZER_MODE !== "remote") {
    return {
      ...empty,
      status: "unavailable",
      message:
        "Code execution requires the secure Java backend, which is not connected yet. No output is simulated.",
    };
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, fileName }),
    });
  } catch {
    throw new AnalyzerConnectionError("Java backend unreachable");
  }
  if (!res.ok) throw new AnalyzerConnectionError(`Run endpoint responded with ${res.status}`);
  const raw = (await res.json()) as Partial<RunResult>;
  return {
    status: "ok",
    stdout: typeof raw.stdout === "string" ? raw.stdout : "",
    stderr: typeof raw.stderr === "string" ? raw.stderr : "",
    exitCode: typeof raw.exitCode === "number" ? raw.exitCode : null,
    timedOut: raw.timedOut === true,
  };
}
