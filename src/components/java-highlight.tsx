import type { ReactNode } from "react";
import type { Lang } from "@/lib/languages";

const KW: Record<Lang, Set<string>> = {
  java: new Set("abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while var record true false null".split(" ")),
  python: new Set("False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield print input int str float len range list dict self".split(" ")),
  c: new Set("auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while NULL include define".split(" ")),
};

const TOKEN: Record<Lang, RegExp> = {
  java: /(\/\/.*$|\/\*[\s\S]*?\*\/|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b|\s+|.)/g,
  c: /(\/\/.*$|\/\*[\s\S]*?\*\/|#\s*\w+|<[\w.]+\.h>|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b|\s+|.)/g,
  python: /(#.*$|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b|\s+|.)/g,
};

/** Lightweight syntax highlighting for a single line of Java, Python or C. */
export function highlightCode(line: string, lang: Lang = "java"): ReactNode[] {
  const parts = line.match(TOKEN[lang]) ?? [];
  return parts.map((token, i) => {
    let className = "";
    const comment = lang === "python" ? token.startsWith("#") : token.startsWith("//") || token.startsWith("/*");
    if (comment) className = "text-code-dim italic";
    else if (lang === "c" && (token.startsWith("#") || /^<[\w.]+\.h>$/.test(token))) className = "text-code-key";
    else if (token.startsWith('"') || token.startsWith("'")) className = "text-code-str";
    else if (/^\d/.test(token)) className = "text-code-num";
    else if (KW[lang].has(token)) className = "text-code-key";
    else if (/^[A-Z]/.test(token)) className = "text-code-fn";
    return (
      <span key={i} className={className || undefined}>
        {token}
      </span>
    );
  });
}

export const highlightJava = (line: string) => highlightCode(line, "java");
