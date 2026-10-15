/**
 * Python and C heuristic analysis + parsers for real compiler/interpreter
 * diagnostics. Heuristics are labeled "likely" and never presented as
 * confirmed compiler errors; confirmed errors come from the sandbox output.
 */
import type { AnalysisIssue, AnalysisResult } from "@/lib/java-analyzer";
import type { Lang } from "@/lib/languages";

let n = 0;
const mk = (i: Omit<AnalysisIssue, "id">): AnalysisIssue => ({ id: `h-${++n}-${i.line}`, ...i });

function stripStrings(line: string, hash: boolean): string {
  let out = "";
  let q: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (q) {
      if (ch === "\\") { out += "  "; i++; continue; }
      if (ch === q) { q = null; out += ch; } else out += " ";
      continue;
    }
    if (ch === '"' || ch === "'") { q = ch; out += ch; continue; }
    if (hash && ch === "#") break;
    if (!hash && ch === "/" && line[i + 1] === "/") break;
    out += ch;
  }
  return out;
}

function result(source: string, fileName: string, issues: AnalysisIssue[], fixed: string[], started: number, language: Lang): AnalysisResult {
  return {
    success: true,
    valid: !issues.some((i) => i.severity === "error"),
    fileName,
    source,
    correctedCode: fixed.join("\n"),
    lineCount: fixed.length,
    durationMs: Date.now() - started,
    analyzedAt: new Date().toISOString(),
    errors: issues.sort((a, b) => a.line - b.line),
    language,
  };
}

const PY_BLOCK = /^(def|class|if|elif|else|for|while|try|except|finally|with|async\s+def)\b/;
const PY_BUILTINS = new Set("print input int str float len range list dict set tuple bool abs min max sum sorted enumerate zip map filter open type isinstance round True False None self super Exception ValueError TypeError KeyError IndexError ZeroDivisionError object any all reversed chr ord hex bin format iter next divmod pow id hash repr".split(" "));
const PY_KW = new Set("and or not in is if elif else for while def class return import from as try except finally with lambda pass break continue yield global nonlocal raise del assert async await".split(" "));

export function analyzePython(source: string, fileName = "main.py"): AnalysisResult {
  const started = Date.now();
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const fixed = [...lines];
  const issues: AnalysisIssue[] = [];
  const defined = new Set<string>();
  const clean = lines.map((l) => stripStrings(l, true));

  clean.forEach((l) => {
    for (const m of l.matchAll(/\b([A-Za-z_]\w*)\s*(?:,\s*[A-Za-z_]\w*\s*)*(?<![=!<>])=(?!=)/g)) l.slice(0, m.index).trim() === "" && m[0].split(/[,=]/).forEach((v) => v.trim() && defined.add(v.trim()));
    const d = l.match(/^\s*(?:def|class)\s+([A-Za-z_]\w*)\s*(?:\(([^)]*)\))?/);
    if (d) { defined.add(d[1]!); (d[2] ?? "").split(",").forEach((p) => { const v = p.split(/[=:]/)[0]!.replace(/\*/g, "").trim(); if (v) defined.add(v); }); }
    const f = l.match(/^\s*for\s+(.+?)\s+in\b/);
    if (f) f[1]!.split(",").forEach((v) => defined.add(v.replace(/[()]/g, "").trim()));
    const imp = l.match(/^\s*(?:from\s+\S+\s+)?import\s+(.+)/);
    if (imp) imp[1]!.split(",").forEach((v) => defined.add(v.trim().split(/\s+as\s+/).pop()!.split(".")[0]!));
    const ex = l.match(/\bas\s+([A-Za-z_]\w*)\s*:/);
    if (ex) defined.add(ex[1]!);
  });

  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const l = clean[i]!;
    const t = l.trim();
    if (!t) continue;
    for (const ch of l) { if ("([{".includes(ch)) depth++; else if (")]}".includes(ch)) depth--; }
    if (PY_BLOCK.test(t) && !t.endsWith(":") && depth === 0 && !t.endsWith("\\")) {
      fixed[i] = raw.replace(/\s*$/, ":");
      issues.push(mk({ line: i + 1, type: "Syntax Error", severity: "error", message: "Expected ':' at the end of this statement", explanation: "Python statements that open a block (def, if, for, while, class…) must end with a colon.", suggestion: "Add ':' at the end of the line.", originalLine: raw, correctedLine: fixed[i] }));
    }
    if (t.endsWith(":") || (PY_BLOCK.test(t) && !t.endsWith(":"))) {
      let j = i + 1;
      while (j < lines.length && !lines[j]!.trim()) j++;
      const ind = (s: string) => s.match(/^\s*/)![0].replace(/\t/g, "    ").length;
      if (j < lines.length && ind(lines[j]!) <= ind(raw)) {
        fixed[j] = " ".repeat(ind(raw) + 4) + lines[j]!.trim();
        issues.push(mk({ line: j + 1, type: "Indentation Error", severity: "error", message: "Expected an indented block", explanation: `Line ${i + 1} opens a block, so the next line must be indented further than it.`, suggestion: "Indent the block body by 4 spaces.", originalLine: lines[j]!, correctedLine: fixed[j] }));
      }
    }
    if (/["']\s*\+\s*\d|\d\s*\+\s*["']/.test(stripStrings(raw, true).replace(/"[^"]*"|'[^']*'/g, '""'))) {
      issues.push(mk({ line: i + 1, type: "Type Error", severity: "warning", message: "Likely: adding text and a number", explanation: "Python cannot use + between a str and an int; this raises TypeError at runtime.", suggestion: "Convert with str(number) or int(text) first.", originalLine: raw }));
    }
    if (!/^\s*(def|class|import|from)\b/.test(l)) {
      const body = l.replace(/"[^"]*"|'[^']*'/g, "");
      for (const m of body.matchAll(/(?<![.\w])([A-Za-z_]\w*)\b(?!\s*=[^=])/g)) {
        const name = m[1]!;
        if (PY_KW.has(name) || PY_BUILTINS.has(name) || defined.has(name)) continue;
        if (/=\s*$/.test(body.slice(0, m.index).replace(/[^=]*$/, "")) && false) continue;
        if (body.slice(m.index! + name.length).trimStart().startsWith("=") && !body.slice(m.index! + name.length).trimStart().startsWith("==")) continue;
        issues.push(mk({ line: i + 1, type: "Undefined Variable", severity: "warning", message: `Likely undefined name '${name}'`, explanation: `'${name}' is used but never assigned, defined or imported, so Python will raise NameError.`, suggestion: `Assign '${name}' before using it, or check the spelling.`, originalLine: raw }));
        break;
      }
    }
  }
  if (depth > 0) issues.push(mk({ line: lines.length, type: "Syntax Error", severity: "error", message: "Unclosed bracket", explanation: "A ( [ or { was opened but never closed.", suggestion: "Add the missing closing bracket.", originalLine: lines[lines.length - 1] ?? "" }));
  return result(source, fileName, issues, fixed, started, "python");
}

const C_HEADERS: [RegExp, string][] = [
  [/\b(printf|scanf|puts|getchar|fgets|putchar|fprintf)\s*\(/, "stdio.h"],
  [/\b(strlen|strcpy|strcmp|strcat|memset|memcpy)\s*\(/, "string.h"],
  [/\b(malloc|free|calloc|realloc|exit|atoi|rand)\s*\(/, "stdlib.h"],
  [/\b(sqrt|pow|sin|cos|fabs)\s*\(/, "math.h"],
];
const C_TYPES = "int|char|float|double|long|short|unsigned|void|size_t|struct\\s+\\w+";

export function analyzeC(source: string, fileName = "main.c"): AnalysisResult {
  const started = Date.now();
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const fixed = [...lines];
  const issues: AnalysisIssue[] = [];
  const clean = lines.map((l) => stripStrings(l, false));
  const declared = new Set<string>(["NULL", "EOF", "stdin", "stdout", "stderr", "main", "argc", "argv"]);
  clean.forEach((l) => {
    const re = new RegExp(`\\b(?:const\\s+)?(?:${C_TYPES})\\s*\\**\\s*([^;(){}]+)`, "g");
    for (const m of l.matchAll(re)) m[1]!.split(",").forEach((p) => { const v = p.split("=")[0]!.replace(/[*\[\]\d\s]/g, "").trim(); if (v) declared.add(v); });
    const fn = l.match(new RegExp(`\\b(?:${C_TYPES})\\s*\\**\\s*([A-Za-z_]\\w*)\\s*\\(([^)]*)\\)`));
    if (fn) { declared.add(fn[1]!); fn[2]!.split(",").forEach((p) => { const v = p.trim().split(/[\s*]+/).pop(); if (v) declared.add(v.replace(/\[\]/, "")); }); }
    const def = l.match(/^\s*#\s*define\s+(\w+)/);
    if (def) declared.add(def[1]!);
  });
  const includes = source.match(/#\s*include\s*<[^>]+>/g)?.join(" ") ?? "";
  let braces = 0;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const t = clean[i]!.trim();
    for (const ch of t) { if (ch === "{") braces++; else if (ch === "}") braces--; }
    if (!t || t.startsWith("#")) continue;
    for (const [re, h] of C_HEADERS) {
      if (re.test(t) && !includes.includes(h)) {
        issues.push(mk({ line: i + 1, type: "Missing Header File", severity: "error", message: `Function used without #include <${h}>`, explanation: `This function is declared in <${h}>, which is not included, so the compiler does not know it.`, suggestion: `Add #include <${h}> at the top of the file.`, originalLine: raw, correctedLine: `#include <${h}>` }));
      }
    }
    const next = clean.slice(i + 1).find((x) => x.trim())?.trim() ?? "";
    if (/[\w)\]"'+-]$/.test(t) && !/^(if|else|for|while|do|switch|case|default)\b/.test(t) && !/^[{}]/.test(next) === false ? false : /[\w)\]"'+-]$/.test(t) && !/^(if|else|for|while|do|switch|case|default)\b/.test(t) && !next.startsWith("{") && !/\)\s*$/.test(t.replace(/^.*\b(?:printf|scanf|return|puts)\b.*$/, "x")) ) {
      fixed[i] = raw.replace(/\s*$/, ";");
      issues.push(mk({ line: i + 1, type: "Missing Semicolon", severity: "error", message: "Statement is missing ';'", explanation: "Every C statement must end with a semicolon.", suggestion: "Add ';' at the end of this statement.", originalLine: raw, correctedLine: fixed[i] }));
    }
    const body = t.replace(/"[^"]*"|'[^']*'/g, "");
    if (!new RegExp(`^(?:${C_TYPES})\\b`).test(body)) {
      for (const m of body.matchAll(/(?<![.\w>])([A-Za-z_]\w*)\b(?!\s*\()/g)) {
        const name = m[1]!;
        if (declared.has(name) || /^(return|if|else|for|while|do|switch|case|break|continue|sizeof|default|goto|struct|const|static)$/.test(name)) continue;
        issues.push(mk({ line: i + 1, type: "Undeclared Variable", severity: "warning", message: `Likely undeclared identifier '${name}'`, explanation: `'${name}' is used but never declared, which gcc reports as an error.`, suggestion: `Declare it first, e.g. int ${name} = 0;`, originalLine: raw }));
        break;
      }
    }
    if (/\bint\s+\w+\s*=\s*"/.test(t)) issues.push(mk({ line: i + 1, type: "Type Error", severity: "warning", message: "Likely: assigning text to an int", explanation: "A string literal is a char array, not an integer.", suggestion: "Use char *name = \"…\"; or a number.", originalLine: raw }));
  }
  if (braces > 0) issues.push(mk({ line: lines.length, type: "Missing Bracket", severity: "error", message: "Missing closing '}'", explanation: "A block was opened with '{' but never closed.", suggestion: "Add the missing '}'.", originalLine: lines[lines.length - 1] ?? "" }));
  return result(source, fileName, issues, fixed, started, "c");
}

/* ---------- Real diagnostics parsers ---------- */

function enrich(line: number, heuristic: AnalysisIssue[]) {
  return heuristic.find((h) => h.line === line);
}

/** gcc: "main.c:4:5: error: msg" */
export function gccIssues(out: string, code: string, heuristic: AnalysisIssue[]): AnalysisIssue[] {
  const lines = code.split("\n");
  const res: AnalysisIssue[] = [];
  for (const m of out.matchAll(/^[^\s:]+\.c:(\d+):(?:\d+:)?\s*(error|warning|fatal error):\s*(.*)$/gm)) {
    const line = Math.max(1, Math.min(lines.length, Number(m[1])));
    const msg = m[3]!.trim();
    const l = msg.toLowerCase();
    const h = enrich(line, heuristic);
    let type = "Compilation Error", explanation = "gcc rejected this line.", suggestion = "Correct the syntax on this line.";
    if (l.includes("expected ';'")) { type = "Missing Semicolon"; explanation = "Every C statement must end with a semicolon."; suggestion = "Add ';' at the end of the previous statement."; }
    else if (l.includes("undeclared")) { type = "Undeclared Variable"; explanation = "This identifier is used without being declared first."; suggestion = "Declare the variable with a type before using it."; }
    else if (l.includes("implicit declaration") || l.includes("no such file")) { type = "Missing Header File"; explanation = "The function's header is not included (or the header name is wrong)."; suggestion = "Add the correct #include at the top."; }
    else if (l.includes("incompatible") || l.includes("makes integer from pointer") || l.includes("format")) { type = "Type Error"; explanation = "A value of the wrong type is used here."; suggestion = "Use a value or format specifier matching the declared type."; }
    else if (l.includes("expected '}'") || l.includes("expected declaration or statement at end")) { type = "Missing Bracket"; explanation = "A block was opened but never closed."; suggestion = "Add the missing '}'."; }
    res.push({ id: `gcc-${res.length}`, line, type: h?.type ?? type, severity: m[2] === "warning" ? "warning" : "error", message: `gcc: ${msg}`, explanation: h?.explanation ?? explanation, suggestion: h?.suggestion ?? suggestion, originalLine: lines[line - 1] ?? "", correctedLine: h?.correctedLine });
  }
  return res;
}

const PY_EXPLAIN: Record<string, [string, string]> = {
  SyntaxError: ["The code is not valid Python syntax.", "Check for a missing ':' , bracket or quote on this line."],
  IndentationError: ["The indentation does not match the block structure.", "Indent block bodies consistently (4 spaces)."],
  TabError: ["Tabs and spaces are mixed in indentation.", "Use only spaces for indentation."],
  NameError: ["A name is used before it was defined.", "Define the variable/function first or fix the spelling."],
  TypeError: ["An operation was applied to a value of the wrong type.", "Convert values to compatible types (e.g. str(), int())."],
  ValueError: ["A value has the right type but an invalid content (e.g. int('abc')).", "Validate or clean the input before converting it."],
  IndexError: ["A list index is outside the list's range.", "Check the list length before indexing."],
  KeyError: ["The dictionary has no such key.", "Use dict.get() or check 'key in dict' first."],
  ZeroDivisionError: ["A number was divided by zero.", "Check that the divisor is not zero."],
  EOFError: ["input() was called but no more input was provided.", "Provide values in the Program input box."],
  AttributeError: ["The object has no such attribute or method.", "Check the spelling and the object's type."],
};

/** Python traceback → one issue (last frame line, final exception line). */
export function pythonIssues(stderr: string, code: string): { issues: AnalysisIssue[]; syntax: boolean } {
  const lines = code.split("\n");
  const ln = [...stderr.matchAll(/line (\d+)/g)].pop()?.[1];
  const last = stderr.trim().split("\n").reverse().find((l) => /^\w+(Error|Exception|Interrupt)\b/.test(l.trim()));
  if (!last) return { issues: [], syntax: false };
  const kind = last.trim().split(":")[0]!;
  const line = Math.max(1, Math.min(lines.length, Number(ln ?? 1)));
  const [explanation, suggestion] = PY_EXPLAIN[kind] ?? ["Python raised an exception while running this line.", "Read the error message and correct the code."];
  const syntax = /SyntaxError|IndentationError|TabError/.test(kind);
  return {
    syntax,
    issues: [{ id: "py-0", line, type: syntax ? kind.replace("Error", " Error") : `Runtime Error (${kind})`, severity: "error", message: `python: ${last.trim()}`, explanation, suggestion, originalLine: lines[line - 1] ?? "" }],
  };
}

/** Java runtime exception: "Exception in thread "main" java.lang.X ... at Main.main(Main.java:4)" */
export function javaRuntimeIssue(stderr: string, code: string): AnalysisIssue | null {
  const ex = stderr.match(/Exception in thread "\w+" ([\w.$]+)(?::\s*(.*))?/);
  if (!ex) return null;
  const lines = code.split("\n");
  const line = Math.max(1, Math.min(lines.length, Number(stderr.match(/\.java:(\d+)\)/)?.[1] ?? 1)));
  const name = ex[1]!.split(".").pop()!;
  return { id: "jrt-0", line, type: `Runtime Error (${name})`, severity: "error", message: `java: ${ex[1]}${ex[2] ? `: ${ex[2]}` : ""}`, explanation: "The program compiled, but threw an exception while running this line.", suggestion: name.includes("Index") ? "Check array/list bounds before accessing an element." : name.includes("Arithmetic") ? "Check for division by zero." : name.includes("NullPointer") ? "Make sure the object is initialized before use." : name.includes("InputMismatch") || name.includes("NoSuchElement") ? "Provide valid input in the Program input box." : "Handle the exception or fix the faulty logic.", originalLine: lines[line - 1] ?? "" };
}

/** Simulated output: only literal prints with no input/variables — otherwise explain. */
export function simulateOutput(language: Lang, code: string): { stdout: string | null; note: string } {
  const re = language === "java" ? /System\.out\.print(ln)?\s*\(\s*"((?:[^"\\]|\\.)*)"\s*\)\s*;/g : language === "python" ? /^\s*print\(\s*(["'])((?:(?!\1)[^\\]|\\.)*)\1\s*\)\s*$/gm : /printf\s*\(\s*"((?:[^"\\%]|\\.)*)"\s*\)\s*;/g;
  const dynamic = language === "java" ? /Scanner|System\.in|System\.out\.print(?:ln)?\s*\((?!\s*"[^"]*"\s*\))|for\s*\(|while\s*\(|if\s*\(/ : language === "python" ? /input\(|for |while |if |print\((?!\s*["'][^"']*["']\s*\))/ : /scanf|for\s*\(|while\s*\(|if\s*\(|printf\s*\(\s*"[^"]*%/;
  if (dynamic.test(code)) return { stdout: null, note: "Output depends on input, variables or control flow, so it cannot be reliably predicted without real execution. Switch to Real Execution mode to see actual output." };
  let out = "";
  for (const m of code.matchAll(re)) {
    const text = (language === "python" ? m[2]! : language === "java" ? m[2]! : m[1]!).replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\(["'\\])/g, "$1");
    out += language === "c" ? text : language === "java" && !m[1] ? text : text + "\n";
  }
  if (!out) return { stdout: null, note: "No literal print statements found; output cannot be illustrated without real execution." };
  return { stdout: out, note: "Illustrative only — derived from literal print statements." };
}
