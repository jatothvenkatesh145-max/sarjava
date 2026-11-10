import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const requestSchema = z.object({
  source: z.string().min(1).max(64 * 1024),
  diagnostics: z.array(z.object({
    line: z.number().int().positive(),
    type: z.string().max(100),
    severity: z.enum(["error", "warning"]),
    message: z.string().max(1000),
    explanation: z.string().max(1600),
    suggestion: z.string().max(1600),
    originalLine: z.string().max(1000),
  })).max(20),
}).strict().superRefine((input, context) => {
  const lineCount = input.source.split("\n").length;
  input.diagnostics.forEach((diagnostic, index) => {
    if (diagnostic.line > lineCount) {
      context.addIssue({ code: "custom", path: ["diagnostics", index, "line"], message: "Diagnostic line is outside the source." });
    }
  });
});

const requestTimestamps = new Map<string, number[]>();

function isRateLimited(clientKey: string): boolean {
  const now = Date.now();
  const recent = (requestTimestamps.get(clientKey) ?? []).filter((time) => now - time < 60_000);
  recent.push(now);
  requestTimestamps.set(clientKey, recent);
  if (requestTimestamps.size > 5000) requestTimestamps.clear();
  return recent.length > 5;
}

export type GeminiExplanationResult =
  | { ok: true; commentary: import("@/lib/gemini.server").GeminiCommentary }
  | { ok: false; reason: "not_configured" | "rate_limited" | "provider_rejected" | "timeout" | "unavailable" };

/** Optional Java tutor commentary; never changes the deterministic Judge0 result. */
export const explainJavaDiagnostics = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => requestSchema.parse(input))
  .handler(async ({ data }): Promise<GeminiExplanationResult> => {
    const ip = getRequestHeader("cf-connecting-ip") || "anon";
    if (isRateLimited(ip)) return { ok: false, reason: "rate_limited" };

    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) return { ok: false, reason: "not_configured" };

    const { requestGeminiCommentary } = await import("@/lib/gemini.server");
    const result = await requestGeminiCommentary(apiKey, data.source, data.diagnostics);
    if (result.kind === "ok") return { ok: true, commentary: result.commentary };
    return { ok: false, reason: result.kind === "rejected" ? "provider_rejected" : result.kind };
  });