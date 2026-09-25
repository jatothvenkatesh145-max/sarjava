/**
 * Local (mock) Java static analyzer.
 *
 * IMPORTANT: this is a heuristic, browser-side static pass over Java source.
 * It is NOT a Java compiler and does not execute code. It exists so the whole
 * UI can be exercised before a real Java analysis backend is connected
 * (see src/services/analyzerService.ts).
 */

export type IssueSeverity = "error" | "warning";

export interface AnalysisIssue {
  id: string;
  line: number;
  type: string;
  severity: IssueSeverity;
  message: string;
  explanation: string;
  suggestion: string;
  originalLine: string;
  correctedLine?: string;
}

export interface AnalysisResult {
  success: boolean;
  valid: boolean;
  fileName: string;
  source: string;
  correctedCode: string;
  lineCount: number;
  durationMs: number;
  analyzedAt: string;
  errors: AnalysisIssue[];
}

const CONTROL_STARTS =
  /^(if|else|for|while|do|switch|case|default|try|catch|finally|synchronized)\b/;
const DECLARATION_START =
  /^(public|private|protected|static|final|abstract|class|interface|enum|record|@|package|import)\b/;
const PRIMITIVES = ["int", "long", "short", "byte", "float", "double", "boolean", "char"];

/** Blank out string/char literals and comments so scanning is safe. */
function sanitize(lines: string[]): string[] {
  let inBlock = false;
  return lines.map((raw) => {
    let out = "";
    let i = 0;
    while (i < raw.length) {
      const two = raw.slice(i, i + 2);
      if (inBlock) {
        if (two === "*/") {
          inBlock = false;
          i += 2;
        } else {
          i += 1;
        }
        out += " ";
        continue;
      }
      if (two === "/*") {
        inBlock = true;
        i += 2;
        out += "  ";
        continue;
      }
      if (two === "//") {
        out += " ".repeat(raw.length - i);
        break;
      }
      const ch = raw[i];
      if (ch === '"' || ch === "'") {
        const quote = ch;
        out += quote;
        i += 1;
        while (i < raw.length && raw[i] !== quote) {
          if (raw[i] === "\\") {
            out += "  ";
            i += 2;
            continue;
          }
          out += " ";
          i += 1;
        }
        if (i < raw.length) {
          out += quote;
          i += 1;
        }
        continue;
      }
      out += ch;
      i += 1;
    }
    return out;
  });
}

let counter = 0;
function makeIssue(issue: Omit<AnalysisIssue, "id">): AnalysisIssue {
  counter += 1;
  return { id: `issue-${counter}-${issue.line}`, ...issue };
}

function baseName(fileName: string) {
  return fileName.replace(/\.java$/i, "");
}

export function analyzeJava(source: string, fileName = "Main.java"): AnalysisResult {
  const started = Date.now();
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const clean = sanitize(lines);
  const issues: AnalysisIssue[] = [];

  const declared = new Set<string>();
  const declaredAt = new Map<string, number>();

  let braces = 0;
  let parens = 0;
  let lastOpenBraceLine = 0;

  for (let i = 0; i < clean.length; i += 1) {
    const lineNo = i + 1;
    const raw = lines[i] ?? "";
    const code = (clean[i] ?? "").trim();
    if (!code) continue;

    // --- bracket balance -------------------------------------------------
    for (const ch of code) {
      if (ch === "{") {
        braces += 1;
        lastOpenBraceLine = lineNo;
      }
      if (ch === "}") braces -= 1;
      if (ch === "(") parens += 1;
      if (ch === ")") parens -= 1;
    }
    if (braces < 0) {
      issues.push(
        makeIssue({
          line: lineNo,
          type: "Syntax Error",
          severity: "error",
          message: "Unexpected closing brace `}`",
          explanation:
            "There is a closing brace here without a matching opening brace `{`. Every block that closes must have been opened earlier.",
          suggestion: "Remove this `}` or add the missing opening brace for the block.",
          originalLine: raw,
        }),
      );
      braces = 0;
    }

    const openP = (code.match(/\(/g) ?? []).length;
    const closeP = (code.match(/\)/g) ?? []).length;
    if (openP !== closeP && !code.endsWith(",") && !code.endsWith("+")) {
      const missing = openP > closeP ? ")" : "(";
      issues.push(
        makeIssue({
          line: lineNo,
          type: "Syntax Error",
          severity: "error",
          message: `Unbalanced parentheses — missing \`${missing}\``,
          explanation:
            "The number of opening and closing parentheses on this line does not match, so Java cannot tell where the expression ends.",
          suggestion: `Add the missing \`${missing}\` so every parenthesis is paired.`,
          originalLine: raw,
          correctedLine:
            missing === ")" ? raw.replace(/;?\s*$/, ");") : undefined,
        }),
      );
      parens = 0;
    }

    // --- typos -----------------------------------------------------------
    if (/System\s*\.\s*out\s*\.\s*printLn/.test(code)) {
      issues.push(
        makeIssue({
          line: lineNo,
          type: "Method Error",
          severity: "error",
          message: "Undefined method `printLn`",
          explanation:
            "Java method names are case sensitive. The printing method is written `println` with a lowercase L-N ending.",
          suggestion: "Use `System.out.println(...)`.",
          originalLine: raw,
          correctedLine: raw.replace(/printLn/g, "println"),
        }),
      );
    }
    if (/\bSytem\s*\./.test(code) || /\bSystm\s*\./.test(code)) {
      issues.push(
        makeIssue({
          line: lineNo,
          type: "Class Error",
          severity: "error",
          message: "Unknown class — `System` is misspelled",
          explanation:
            "Java cannot find a class with this name. The standard output class is spelled `System`.",
          suggestion: "Correct the spelling to `System`.",
          originalLine: raw,
          correctedLine: raw.replace(/Sytem|Systm/g, "System"),
        }),
      );
    }

    // --- data type mismatches -------------------------------------------
    const numAssign = code.match(
      /\b(int|long|short|byte)\s+([A-Za-z_]\w*)\s*=\s*"(?:[^"]*)"/,
    );
    if (numAssign) {
      issues.push(
        makeIssue({
          line: lineNo,
          type: "Data Type Error",
          severity: "error",
          message: `Cannot assign a text value to \`${numAssign[1]} ${numAssign[2]}\``,
          explanation:
            "A value in double quotes is a String. A whole-number variable can only hold numbers, so Java refuses the assignment (incompatible types: String cannot be converted to " +
            numAssign[1] +
            ").",
          suggestion: `Either store a number, e.g. \`${numAssign[1]} ${numAssign[2]} = 0;\`, or declare the variable as \`String ${numAssign[2]}\`.`,
          originalLine: raw,
          correctedLine: raw.replace(
            new RegExp(`\\b${numAssign[1]}\\s+${numAssign[2]}`),
            `String ${numAssign[2]}`,
          ),
        }),
      );
    }
    const strAssign = code.match(/\bString\s+([A-Za-z_]\w*)\s*=\s*(-?\d+(?:\.\d+)?)\s*;/);
    if (strAssign) {
      issues.push(
        makeIssue({
          line: lineNo,
          type: "Data Type Error",
          severity: "error",
          message: `Cannot assign a number to the String \`${strAssign[1]}\``,
          explanation:
            "A String holds text. Assigning a bare number is an incompatible type in Java.",
          suggestion: `Wrap the value in quotes: \`String ${strAssign[1]} = "${strAssign[2]}";\``,
          originalLine: raw,
          correctedLine: raw.replace(strAssign[2], `"${strAssign[2]}"`),
        }),
      );
    }
    const intFromDouble = code.match(/\bint\s+([A-Za-z_]\w*)\s*=\s*(\d+\.\d+)\s*;/);
    if (intFromDouble) {
      issues.push(
        makeIssue({
          line: lineNo,
          type: "Data Type Error",
          severity: "error",
          message: `Decimal value assigned to the int \`${intFromDouble[1]}\``,
          explanation:
            "`int` stores whole numbers only. Java will not silently drop the decimal part (possible lossy conversion from double to int).",
          suggestion: `Use \`double ${intFromDouble[1]} = ${intFromDouble[2]};\` or round the value with \`(int) ${intFromDouble[2]}\`.`,
          originalLine: raw,
          correctedLine: raw.replace(/\bint\b/, "double"),
        }),
      );
    }
    const boolAssign = code.match(/\bboolean\s+([A-Za-z_]\w*)\s*=\s*"(?:[^"]*)"/);
    if (boolAssign) {
      issues.push(
        makeIssue({
          line: lineNo,
          type: "Data Type Error",
          severity: "error",
          message: `Text assigned to the boolean \`${boolAssign[1]}\``,
          explanation: "A boolean can only be `true` or `false`, never a String.",
          suggestion: `Write \`boolean ${boolAssign[1]} = true;\` (or false).`,
          originalLine: raw,
        }),
      );
    }

    // --- variable declarations / duplicates ------------------------------
    const declPattern = new RegExp(
      `\\b(?:${PRIMITIVES.join("|")}|String|var|[A-Z]\\w*)(?:\\s*\\[\\s*\\])?\\s+([A-Za-z_]\\w*)\\s*(=|;)`,
    );
    const decl = code.match(declPattern);
    if (decl && !CONTROL_STARTS.test(code) && !code.includes("(" + decl[1])) {
      const name = decl[1];
      if (declared.has(name)) {
        issues.push(
          makeIssue({
            line: lineNo,
            type: "Variable Error",
            severity: "error",
            message: `Variable \`${name}\` is already defined`,
            explanation: `\`${name}\` was declared earlier (line ${declaredAt.get(name)}). Java does not allow two declarations of the same variable in the same scope.`,
            suggestion: `Remove the type from this line and just assign: \`${name} = ...;\`, or rename the variable.`,
            originalLine: raw,
          }),
        );
      } else {
        declared.add(name);
        declaredAt.set(name, lineNo);
      }
    }

    // --- undeclared variable ---------------------------------------------
    const plainAssign = code.match(/^([A-Za-z_]\w*)\s*(?:\+|-|\*|\/)?=\s*[^=]/);
    if (plainAssign && !decl && !CONTROL_STARTS.test(code)) {
      const name = plainAssign[1];
      if (!declared.has(name) && !PRIMITIVES.includes(name) && name !== "this") {
        issues.push(
          makeIssue({
            line: lineNo,
            type: "Variable Error",
            severity: "error",
            message: `Cannot find symbol — variable \`${name}\``,
            explanation:
              "The variable is used before it has been declared. Java needs to know the type of every variable before you can store a value in it.",
            suggestion: `Declare it first, for example \`int ${name} = ...;\`.`,
            originalLine: raw,
            correctedLine: raw.replace(name, `int ${name}`),
          }),
        );
        declared.add(name);
        declaredAt.set(name, lineNo);
      }
    }

    // register parameters / loop variables / catch vars: `Type name` pairs anywhere
    for (const m of code.matchAll(
      new RegExp(`\\b(?:${PRIMITIVES.join("|")}|String|var|[A-Z]\\w*)(?:\\s*<[^>]*>)?(?:\\s*\\[\\s*\\])*\\s+([A-Za-z_]\\w*)\\s*(?=[,)=;:])`, "g"),
    )) {
      if (!declared.has(m[1])) {
        declared.add(m[1]);
        declaredAt.set(m[1], lineNo);
      }
    }

    // --- undeclared variable used as a call argument ----------------------
    const noStrings = code.replace(/"(?:\\.|[^"\\])*"/g, '""').replace(/'(?:\\.|[^'\\])*'/g, "''");
    if (!/^\s*(?:public|private|protected|static|class|interface|enum|import|package)\b/.test(noStrings)) {
      for (const call of noStrings.matchAll(/[A-Za-z_]\w*\s*\(([^()]*)\)/g)) {
        for (const arg of call[1].split(/[,+\-*/%<>=!&|]+/)) {
          const name = arg.trim();
          if (
            /^[a-z_]\w*$/.test(name) &&
            !declared.has(name) &&
            !["true", "false", "null", "this", "super", "new"].includes(name)
          ) {
            issues.push(
              makeIssue({
                line: lineNo,
                type: "Variable Error",
                severity: "error",
                message: `Variable '${name}' is not declared`,
                explanation:
                  "The program is trying to use a variable that has not been declared. Java must know a variable's type before it can be used.",
                suggestion: `Declare the variable before using it, e.g. \`int ${name} = 0;\`, or check the spelling.`,
                originalLine: raw,
              }),
            );
            declared.add(name);
          }
        }
      }
    }

    // --- assignment inside condition --------------------------------------
    const condAssign = code.match(/\bif\s*\(\s*([A-Za-z_]\w*)\s*=\s*[^=]/);
    if (condAssign) {
      issues.push(
        makeIssue({
          line: lineNo,
          type: "Logic Error",
          severity: "warning",
          message: "Assignment `=` used inside an `if` condition",
          explanation:
            "A single `=` stores a value instead of comparing. Conditions almost always need `==` (or `.equals()` for objects).",
          suggestion: "Use `==` to compare the two values.",
          originalLine: raw,
          correctedLine: raw.replace(/=\s*(?!=)/, "== "),
        }),
      );
    }

    // --- String comparison with == ----------------------------------------
    if (/==\s*"/.test(code) || /"\s*==/.test(code)) {
      issues.push(
        makeIssue({
          line: lineNo,
          type: "Logic Error",
          severity: "warning",
          message: "Strings compared with `==`",
          explanation:
            "`==` compares object references, not the text itself, so two equal-looking Strings can test as different.",
          suggestion: "Compare with `.equals(...)`, e.g. `name.equals(\"Ana\")`.",
          originalLine: raw,
        }),
      );
    }

    // --- missing semicolon -------------------------------------------------
    const needsSemicolon =
      !code.endsWith(";") &&
      !code.endsWith("{") &&
      !code.endsWith("}") &&
      !code.endsWith(",") &&
      !code.endsWith("(") &&
      !code.endsWith("+") &&
      !code.endsWith("&&") &&
      !code.endsWith("||") &&
      !code.endsWith(":") &&
      !code.endsWith(".") &&
      !code.startsWith("@") &&
      !DECLARATION_START.test(code) &&
      !CONTROL_STARTS.test(code) &&
      !code.startsWith("}") &&
      openP === closeP;

    if (needsSemicolon && /[=)\w\]]$/.test(code)) {
      issues.push(
        makeIssue({
          line: lineNo,
          type: "Syntax Error",
          severity: "error",
          message: "Missing semicolon (;)",
          explanation:
            "Java statements end with a semicolon. Without it the compiler keeps reading the next line as part of this statement.",
          suggestion: `Add a semicolon: \`${code};\``,
          originalLine: raw,
          correctedLine: `${raw.replace(/\s+$/, "")};`,
        }),
      );
    }
  }

  // --- whole-file checks ---------------------------------------------------
  if (braces > 0) {
    issues.push(
      makeIssue({
        line: lines.length,
        type: "Syntax Error",
        severity: "error",
        message: `Missing ${braces} closing brace${braces > 1 ? "s" : ""} \`}\``,
        explanation: `A block opened around line ${lastOpenBraceLine} is never closed, so the class or method never ends.`,
        suggestion: "Add the missing `}` at the end of the file.",
        originalLine: lines[lines.length - 1] ?? "",
      }),
    );
  }
  if (parens > 0) {
    issues.push(
      makeIssue({
        line: lines.length,
        type: "Syntax Error",
        severity: "error",
        message: "Unclosed parenthesis `(`",
        explanation: "An expression opens a parenthesis that is never closed.",
        suggestion: "Add the matching `)`.",
        originalLine: lines[lines.length - 1] ?? "",
      }),
    );
  }

  const classMatch = clean.join("\n").match(/public\s+(?:final\s+|abstract\s+)?class\s+([A-Za-z_]\w*)/);
  if (classMatch && baseName(fileName) && classMatch[1] !== baseName(fileName)) {
    const idx = clean.findIndex((l) => l.includes(`class ${classMatch[1]}`));
    issues.push(
      makeIssue({
        line: idx >= 0 ? idx + 1 : 1,
        type: "Class Error",
        severity: "error",
        message: `Public class \`${classMatch[1]}\` must be in a file named ${classMatch[1]}.java`,
        explanation:
          "Java requires the file name to match the name of the public class it contains.",
        suggestion: `Rename the file to \`${classMatch[1]}.java\`, or rename the class to \`${baseName(fileName)}\`.`,
        originalLine: idx >= 0 ? (lines[idx] ?? "") : "",
      }),
    );
  }

  const hasClass = /\b(class|interface|enum|record)\s+[A-Za-z_]/.test(clean.join("\n"));
  if (source.trim() && !hasClass) {
    issues.push(
      makeIssue({
        line: 1,
        type: "Class Error",
        severity: "error",
        message: "No class declaration found",
        explanation:
          "Every Java program lives inside a class. Statements cannot sit on their own at the top of a file.",
        suggestion: "Wrap your code in `public class Main { ... }`.",
        originalLine: lines[0] ?? "",
      }),
    );
  } else if (hasClass && !/static\s+void\s+main\s*\(/.test(clean.join("\n"))) {
    issues.push(
      makeIssue({
        line: 1,
        type: "Method Warning",
        severity: "warning",
        message: "No `main` method found",
        explanation:
          "A program needs `public static void main(String[] args)` to be run directly. This is fine for a helper class.",
        suggestion: "Add `public static void main(String[] args) { ... }` if this class should run on its own.",
        originalLine: lines[0] ?? "",
      }),
    );
  }

  issues.sort((a, b) => a.line - b.line);

  // --- build the corrected source -----------------------------------------
  const fixedLines = [...lines];
  for (const issue of issues) {
    if (issue.correctedLine && issue.line >= 1 && issue.line <= fixedLines.length) {
      fixedLines[issue.line - 1] = issue.correctedLine;
    }
  }
  let correctedCode = fixedLines.join("\n");
  if (braces > 0) correctedCode += `\n${"}".repeat(braces)}`;

  const errorsOnly = issues.filter((i) => i.severity === "error");

  return {
    success: true,
    valid: errorsOnly.length === 0,
    fileName,
    source,
    correctedCode,
    lineCount: lines.length,
    durationMs: Math.max(1, Date.now() - started),
    analyzedAt: new Date().toISOString(),
    errors: issues,
  };
}
