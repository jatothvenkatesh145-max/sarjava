import type { ReactNode } from "react";

const KEYWORDS = new Set([
  "abstract","assert","boolean","break","byte","case","catch","char","class","const","continue",
  "default","do","double","else","enum","extends","final","finally","float","for","goto","if",
  "implements","import","instanceof","int","interface","long","native","new","package","private",
  "protected","public","return","short","static","strictfp","super","switch","synchronized","this",
  "throw","throws","transient","try","void","volatile","while","var","record","true","false","null",
]);

const TOKEN = /(\/\/.*$|\/\*[\s\S]*?\*\/|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b|\s+|.)/g;

/** Lightweight Java syntax highlighting for a single line of source. */
export function highlightJava(line: string): ReactNode[] {
  const parts = line.match(TOKEN) ?? [];
  return parts.map((token, i) => {
    let className = "";
    if (token.startsWith("//") || token.startsWith("/*")) className = "text-code-dim italic";
    else if (token.startsWith('"') || token.startsWith("'")) className = "text-code-str";
    else if (/^\d/.test(token)) className = "text-code-num";
    else if (KEYWORDS.has(token)) className = "text-code-key";
    else if (/^[A-Z]/.test(token)) className = "text-code-fn";

    return (
      <span key={i} className={className || undefined}>
        {token}
      </span>
    );
  });
}
