import { LANGS, isLang, type Lang } from "@/lib/languages";

/** Shared sandbox runner (Judge0). Never executes code on the app server. */
export interface JudgeResult {
  status: string;
  statusId: number;
  stdout: string;
  stderr: string;
  compileOutput: string;
  time: string | null;
  memoryKb: number | null;
  exitCode: number | null;
}

export const MAX_CODE = 64 * 1024;
export const MAX_STDIN = 16 * 1024;

export function validateInput(input: unknown): { language: Lang; code: string; stdin: string } {
  const i = (input ?? {}) as Record<string, unknown>;
  const language = i["language"] ?? "java";
  if (!isLang(language)) throw new Error("Unsupported language. Use java, python or c.");
  const code = i["code"] ?? i["source_code"];
  if (typeof code !== "string" || !code.trim()) throw new Error("Source code is required");
  if (code.length > MAX_CODE) throw new Error("Source code exceeds 64 KB limit");
  const stdin = typeof i["stdin"] === "string" ? (i["stdin"] as string) : "";
  if (stdin.length > MAX_STDIN) throw new Error("Input exceeds 16 KB limit");
  return { language, code, stdin };
}

// Best-effort per-client rate limit (per worker isolate): 20 runs / minute.
const hits = new Map<string, number[]>();
export function rateLimited(clientKey: string): boolean {
  const now = Date.now();
  const recent = (hits.get(clientKey) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(clientKey, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 20;
}

/** Judge0 compiles Java as Main.java, so rename the public class (same line count). */
function toMainClass(code: string): string {
  const m = code.match(/public\s+(?:final\s+|abstract\s+)*class\s+([A-Za-z_]\w*)/);
  const name = m?.[1];
  if (!name || name === "Main") return code;
  return code.replace(new RegExp(`\\b${name}\\b`, "g"), "Main");
}

export async function runInSandbox(language: Lang, code: string, stdin: string): Promise<JudgeResult> {
  const base = (process.env["JUDGE0_URL"] || "https://ce.judge0.com").replace(/\/$/, "");
  const key = process.env["JUDGE0_KEY"];
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) {
    headers["X-RapidAPI-Key"] = key;
    headers["X-Auth-Token"] = key;
    try {
      headers["X-RapidAPI-Host"] = new URL(base).host;
    } catch {
      /* ignore */
    }
  }
  const res = await fetch(`${base}/submissions?base64_encoded=false&wait=true`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      language_id: LANGS[language].judgeId,
      source_code: language === "java" ? toMainClass(code) : code,
      stdin,
      cpu_time_limit: 5,
      wall_time_limit: 10,
      memory_limit: 256000,
    }),
  });
  if (!res.ok) throw new Error(`Code sandbox responded with ${res.status}`);
  const r = (await res.json()) as {
    stdout?: string | null;
    stderr?: string | null;
    compile_output?: string | null;
    message?: string | null;
    time?: string | null;
    memory?: number | null;
    exit_code?: number | null;
    status?: { id?: number; description?: string };
  };
  return {
    status: r.status?.description ?? "Unknown",
    statusId: r.status?.id ?? 0,
    stdout: r.stdout ?? "",
    stderr: [r.stderr, r.status?.id && r.status.id >= 7 && !r.stderr ? r.message : null].filter(Boolean).join("\n"),
    compileOutput: r.compile_output ?? "",
    time: r.time ?? null,
    memoryKb: r.memory ?? null,
    exitCode: typeof r.exit_code === "number" ? r.exit_code : null,
  };
}
