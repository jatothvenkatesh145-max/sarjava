import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { geminiRequestSchema } from "@/lib/gemini.schema";

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
  .inputValidator((input: unknown) => geminiRequestSchema.parse(input))
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