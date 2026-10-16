/**
 * Analyzer service layer.
 *
 * Detection uses REAL javac diagnostics from the Judge0 sandbox (server fn
 * executeJava). The browser heuristic pass (src/lib/java-analyzer.ts) is used
 * only to enrich compiler errors with plain-English explanations and fixes.
 * Execution never happens in the browser and output is never simulated.
 */

import { analyzeJava, type AnalysisIssue, type AnalysisResult } from "@/lib/java-analyzer";
import { executeCode, type JudgeResult } from "@/lib/java-runner.functions";
import { analyzePython, analyzeC, gccIssues, pythonIssues, javaRuntimeIssue, simulateOutput } from "@/lib/multi-analyzer";
import { LANGS, type Lang } from "@/lib/languages";

export const ANALYZER_MODE = "compiler" as const;

export interface AnalyzeRequest {
  code: string;
  fileName?: string;
  stdin?: string;
  language?: Lang;
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
  compileOutput?: string;
  mode?: "real" | "simulated";
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

export function heuristic(language: Lang, code: string, fileName: string): AnalysisResult {
  const r = language === "python" ? analyzePython(code, fileName) : language === "c" ? analyzeC(code, fileName) : analyzeJava(code, fileName);
  return { ...r, language };
}

function buildResult(language: Lang, judge: JudgeResult, code: string, fileName: string, started: number): AnalysisResult {
  const h = heuristic(language, code, fileName);
  let compileFailed = judge.statusId === 6;
  let errors: AnalysisIssue[] = [];
  if (language === "java") {
    if (compileFailed) errors = compilerIssues(judge.compileOutput, code, h.errors);
    else { const rt = javaRuntimeIssue(judge.stderr, code); if (rt) errors.push(rt); }
  } else if (language === "c") {
    errors = gccIssues(judge.compileOutput, code, h.errors);
    if (!compileFailed) errors = errors.filter((e) => e.severity === "warning");
    if (!compileFailed && judge.statusId >= 7) errors.push({ id: "crt-0", line: 1, type: `Runtime Error`, severity: "error", message: `runtime: ${judge.stderr.split("\n").find((l) => l.trim()) ?? judge.status}`, explanation: (judge.status + judge.stderr).match(/SIGFPE|Floating point/i) ? "The program performed an invalid arithmetic operation, such as division by zero." : (judge.status + judge.stderr).match(/SIGSEGV|Segmentation/i) ? "The program accessed memory it does not own (bad pointer or array index)." : "The program crashed or returned a non-zero exit code.", suggestion: "Check divisions, array indexes and pointers.", originalLine: code.split("\n")[0] ?? "" });
  } else {
    const p = pythonIssues(judge.stderr, code);
    errors = p.issues;
    compileFailed = p.syntax;
  }
  if (compileFailed && errors.length === 0) {
    errors = [{ id: "cc-0", line: 1, type: "Compilation Error", severity: "error", message: (judge.compileOutput || judge.stderr).trim() || "Compilation failed", explanation: "The compiler could not compile this program.", suggestion: "Review the compiler message.", originalLine: code.split("\n")[0] ?? "" }];
  }
  if (!compileFailed) errors = [...errors, ...h.errors.filter((e) => e.severity === "warning" && !errors.some((x) => x.line === e.line))];
  return {
    success: true,
    valid: !compileFailed,
    fileName,
    source: code,
    correctedCode: compileFailed ? h.correctedCode : code,
    lineCount: code.split("\n").length,
    durationMs: Date.now() - started,
    analyzedAt: new Date().toISOString(),
    errors,
    language,
  };
}

function toRun(judge: JudgeResult): RunResult {
  return { status: "ok", mode: "real", stdout: judge.stdout, stderr: judge.stderr, compileOutput: judge.compileOutput, exitCode: judge.exitCode, timedOut: judge.statusId === 5, statusText: judge.status, time: judge.time, memoryKb: judge.memoryKb };
}

async function callSandbox(language: Lang, code: string, stdin: string): Promise<JudgeResult> {
  try {
    return await executeCode({ data: { language, code, stdin } });
  } catch (e) {
    throw new AnalyzerConnectionError(e instanceof Error ? e.message : "Code sandbox unreachable");
  }
}

/** Real mode: compile with the language's compiler and return real diagnostics. */
export async function analyzeCode({ code, fileName, stdin = "", language = "java" }: AnalyzeRequest): Promise<AnalysisResult> {
  const started = Date.now();
  const f = fileName ?? LANGS[language].file;
  return buildResult(language, await callSandbox(language, code, stdin), code, f, started);
}

/** Real mode: compile + execute in one sandbox round-trip. */
export async function analyzeAndRun({ code, fileName, stdin = "", language = "java" }: AnalyzeRequest): Promise<{ result: AnalysisResult; run: RunResult }> {
  const started = Date.now();
  const f = fileName ?? LANGS[language].file;
  const judge = await callSandbox(language, code, stdin);
  const result = buildResult(language, judge, code, f, started);
  const run: RunResult = result.valid
    ? toRun(judge)
    : { status: "blocked", mode: "real", stdout: "", stderr: judge.stderr, compileOutput: judge.compileOutput, exitCode: judge.exitCode, timedOut: false, statusText: judge.status, message: "Program cannot be executed because compilation/syntax errors were detected." };
  return { result, run };
}

/** Simulated mode: heuristic analysis + illustrative output only. Never executes. */
export function simulate({ code, fileName, language = "java" }: AnalyzeRequest): { result: AnalysisResult; run: RunResult } {
  const result = heuristic(language, code, fileName ?? LANGS[language].file);
  if (!result.valid) return { result, run: { status: "blocked", mode: "simulated", stdout: "", stderr: "", exitCode: null, timedOut: false, message: "Likely errors were found by the heuristic checker, so no illustrative output is shown." } };
  const s = simulateOutput(language, code);
  return { result, run: { status: s.stdout == null ? "unavailable" : "ok", mode: "simulated", stdout: s.stdout ?? "", stderr: "", exitCode: null, timedOut: false, message: s.note, statusText: "simulated" } };
}

export type { AnalysisResult };
