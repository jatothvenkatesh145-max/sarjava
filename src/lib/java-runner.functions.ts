import { createServerFn } from "@tanstack/react-start";

/**
 * Real Java compilation + execution via a Judge0 sandbox (server-side only).
 * Defaults to the public Judge0 CE instance; set JUDGE0_URL (and optionally
 * JUDGE0_KEY for RapidAPI / self-hosted auth) to use your own instance.
 */

export interface JudgeResult {
  status: string; // Accepted | Compilation Error | Runtime Error (...) | Time Limit Exceeded | ...
  statusId: number;
  stdout: string;
  stderr: string;
  compileOutput: string;
  time: string | null;
  memoryKb: number | null;
  exitCode: number | null;
}

const MAX_CODE = 64 * 1024;
const MAX_STDIN = 16 * 1024;

/** Judge0 compiles as Main.java, so rename the public class to Main (same line count). */
function toMainClass(code: string): string {
  const m = code.match(/public\s+(?:final\s+|abstract\s+)*class\s+([A-Za-z_]\w*)/);
  const name = m?.[1];
  if (!name || name === "Main") return code;
  return code.replace(new RegExp(`\\b${name}\\b`, "g"), "Main");
}

export const executeJava = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; stdin?: string }) => {
    if (typeof input?.code !== "string" || !input.code.trim()) throw new Error("Source code is required");
    if (input.code.length > MAX_CODE) throw new Error("Source code exceeds 64 KB limit");
    const stdin = typeof input.stdin === "string" ? input.stdin : "";
    if (stdin.length > MAX_STDIN) throw new Error("Input exceeds 16 KB limit");
    return { code: input.code, stdin };
  })
  .handler(async ({ data }): Promise<JudgeResult> => {
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
        language_id: 62, // Java (OpenJDK)
        source_code: toMainClass(data.code),
        stdin: data.stdin,
        cpu_time_limit: 5,
        wall_time_limit: 10,
        memory_limit: 256000,
      }),
    });
    if (!res.ok) throw new Error(`Java sandbox responded with ${res.status}`);
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
      stderr: [r.stderr, r.status?.id && r.status.id >= 7 ? r.message : null].filter(Boolean).join("\n"),
      compileOutput: r.compile_output ?? "",
      time: r.time ?? null,
      memoryKb: r.memory ?? null,
      exitCode: typeof r.exit_code === "number" ? r.exit_code : null,
    };
  });
