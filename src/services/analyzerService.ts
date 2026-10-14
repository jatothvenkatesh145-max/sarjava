/**
 * Analyzer service layer.
 *
 * Detection uses REAL javac diagnostics from the Judge0 sandbox (server fn
 * executeJava). The browser heuristic pass (src/lib/java-analyzer.ts) is used
 * only to enrich compiler errors with plain-English explanations and fixes.
 * Execution never happens in the browser and output is never simulated.
 */

import { analyzeJava, type AnalysisIssue, type AnalysisResult } from "@/lib/java-analyzer";
import { executeJava, type JudgeResult } from "@/lib/java-runner.functions";

export const ANALYZER_MODE = "compiler" as const;

export interface AnalyzeRequest {
  code: string;
  fileName?: string;
  stdin?: string;
}

export class AnalyzerConnectionError extends Error {}

export interface RunResult {
  status: "ok" | "blocked" | "unavailable" | "failed";
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  message?: string;
  statusText?: string;
  time?: string | null;
  memoryKb?: number | null;
}

/** Plain-English explanation for a javac message when no heuristic matched. */
export function explainCompilerMessage(msg: string, src: string): { type: string; explanation: string; suggestion: string } {
  const m = msg.toLowerCase();
  if (m.includes("';' expected"))
    return { type: "Missing Semicolon", explanation: "Every Java statement must end with a semicolon. The compiler reached the end of a statement without finding one.", suggestion: "Add ';' at the end of this statement." };
  if (m.includes("cannot find symbol")) {
    const sym = src.match(/symbol:\s+(variable|method|class)\s+(\S+)/);
    const kind = sym?.[1] ?? "symbol";
    const name = sym?.[2] ?? "this name";
    return {
      type: kind === "method" ? "Undefined Method" : kind === "class" ? "Unknown Class" : "Undeclared Variable",
      explanation: `The ${kind} '${name}' is used but was never declared (or is misspelled / out of scope), so Java cannot resolve it.`,
      suggestion: kind === "variable" ? `Declare '${name}' with a type before using it, e.g. int ${name} = 0;` : kind === "class" ? `Check the spelling of '${name}' or add the missing import.` : `Define the method '${name.split("(")[0]}' or check its spelling and parameters.`,
    };
  }
  if (m.includes("incompatible types"))
    return { type: "Incorrect Data Type", explanation: "A value of one type is being assigned or passed where a different type is required.", suggestion: "Use a value of the declared type, or convert it (e.g. Integer.parseInt for text → int)." };
  if (m.includes("reached end of file") || m.includes("'}' expected") || m.includes("')' expected") || m.includes("'(' expected"))
    return { type: "Missing Bracket", explanation: "Brackets or parentheses are not balanced — something was opened but never closed.", suggestion: "Add the missing closing bracket or parenthesis." };
  if (m.includes("class, interface, enum, or record expected") || m.includes("invalid method declaration") || m.includes("<identifier> expected"))
    return { type: "Invalid Declaration", explanation: "A class or method declaration is malformed (missing return type, misplaced code, or a typo in the header).", suggestion: "Check the declaration syntax, e.g. public static void name() { ... }." };
  if (m.includes("might not have been initialized"))
    return { type: "Uninitialized Variable", explanation: "The variable is read before any value has been assigned to it.", suggestion: "Give the variable an initial value when declaring it." };
  if (m.includes("missing return"))
    return { type: "Missing Return", explanation: "A method that declares a return type can finish without returning a value.", suggestion: "Add a return statement on every path." };
  return { type: "Compilation Error", explanation: "The Java compiler rejected this line.", suggestion: "Read the compiler message and correct the syntax on this line." };
}

/** Parse "Main.java:3: error: msg" blocks into issues, enriched with heuristic explanations. */
export function compilerIssues(compileOutput: string, code: string, heuristic: AnalysisIssue[]): AnalysisIssue[] {
  const lines = code.split("\n");
  const blocks = compileOutput.split(/(?=^\S+\.java:\d+: (?:error|warning):)/m);
  const out: AnalysisIssue[] = [];
  blocks.forEach((block, i) => {
    const h = block.match(/^\S+\.java:(\d+): (error|warning): (.*)$/m);
    if (!h) return;
    const line = Math.max(1, Math.min(lines.length, Number(h[1])));
    const msg = h[3]!.trim();
    const match = heuristic.find((x) => x.line === line);
    const fallback = explainCompilerMessage(msg, block);
    out.push({
      id: `javac-${i}`,
      line,
      type: match?.type ?? fallback.type,
      severity: h[2] === "warning" ? "warning" : "error",
      message: `javac: ${msg}`,
      explanation: match?.explanation || fallback.explanation,
      suggestion: match?.suggestion || fallback.suggestion,
      originalLine: lines[line - 1] ?? "",
      correctedLine: match?.correctedLine,
    });
  });
  return out;
}

function buildResult(judge: JudgeResult, code: string, fileName: string, started: number): AnalysisResult {
  const heuristic = analyzeJava(code, fileName);
  const compileFailed = judge.statusId === 6;
  let errors: AnalysisIssue[] = compileFailed ? compilerIssues(judge.compileOutput, code, heuristic.errors) : [];
  if (compileFailed && errors.length === 0) {
    errors = [{ id: "javac-0", line: 1, type: "Compilation Error", severity: "error", message: judge.compileOutput.trim() || "Compilation failed", explanation: "The Java compiler could not compile this program.", suggestion: "Review the compiler message above.", originalLine: code.split("\n")[0] ?? "" }];
  }
  // Keep heuristic warnings (style / likely issues) when compilation succeeded.
  if (!compileFailed) errors = heuristic.errors.filter((e) => e.severity === "warning");
  return {
    success: true,
    valid: !compileFailed,
    fileName,
    source: code,
    correctedCode: compileFailed ? heuristic.correctedCode : code,
    lineCount: code.split("\n").length,
    durationMs: Date.now() - started,
    analyzedAt: new Date().toISOString(),
    errors,
  };
}

function toRun(judge: JudgeResult): RunResult {
  return {
    status: "ok",
    stdout: judge.stdout,
    stderr: judge.stderr,
    exitCode: judge.exitCode,
    timedOut: judge.statusId === 5,
    statusText: judge.status,
    time: judge.time,
    memoryKb: judge.memoryKb,
  };
}

async function callSandbox(code: string, stdin: string): Promise<JudgeResult> {
  try {
    return await executeJava({ data: { code, stdin } });
  } catch (e) {
    throw new AnalyzerConnectionError(e instanceof Error ? e.message : "Java sandbox unreachable");
  }
}

/** Compile with javac and return real diagnostics. */
export async function analyzeCode({ code, fileName = "Main.java", stdin = "" }: AnalyzeRequest): Promise<AnalysisResult> {
  const started = Date.now();
  return buildResult(await callSandbox(code, stdin), code, fileName, started);
}

/** Compile, and if successful, execute — one sandbox round-trip. */
export async function analyzeAndRun({ code, fileName = "Main.java", stdin = "" }: AnalyzeRequest): Promise<{ result: AnalysisResult; run: RunResult }> {
  const started = Date.now();
  const judge = await callSandbox(code, stdin);
  const result = buildResult(judge, code, fileName, started);
  const run: RunResult = result.valid
    ? toRun(judge)
    : { status: "blocked", stdout: "", stderr: judge.compileOutput, exitCode: null, timedOut: false, statusText: judge.status, message: "Program cannot be executed because compilation errors were detected." };
  return { result, run };
}

export type { AnalysisResult };
