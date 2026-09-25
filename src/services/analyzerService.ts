/**
 * Analyzer service layer.
 *
 * The UI only ever talks to `analyzeCode()`. Two implementations exist:
 *
 *   MOCK    – heuristic browser-side static analysis (src/lib/java-analyzer.ts).
 *             Used while no Java backend is connected.
 *   REMOTE  – POST /api/analyze  { code, fileName }  ->  AnalysisResult-shaped JSON,
 *             served later by the Java analysis engine.
 *
 * Switch modes by changing ANALYZER_MODE (or set VITE_ANALYZER_API to a base URL).
 */

import { analyzeJava, type AnalysisResult } from "@/lib/java-analyzer";

export type AnalyzerMode = "mock" | "remote";

export const ANALYZER_MODE: AnalyzerMode =
  (import.meta.env.VITE_ANALYZER_API as string | undefined) ? "remote" : "mock";

export interface AnalyzeRequest {
  code: string;
  fileName?: string;
}

async function analyzeRemote({ code, fileName }: AnalyzeRequest): Promise<AnalysisResult> {
  const base = (import.meta.env.VITE_ANALYZER_API as string | undefined) ?? "";
  const res = await fetch(`${base}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, fileName }),
  });
  if (!res.ok) throw new Error(`Analyzer backend responded with ${res.status}`);
  return (await res.json()) as AnalysisResult;
}

async function analyzeMock({ code, fileName }: AnalyzeRequest): Promise<AnalysisResult> {
  // Small delay so loading states are visible, matching a real network round trip.
  await new Promise((r) => setTimeout(r, 450));
  return analyzeJava(code, fileName ?? "Main.java");
}

export async function analyzeCode(req: AnalyzeRequest): Promise<AnalysisResult> {
  if (ANALYZER_MODE === "remote") {
    try {
      return await analyzeRemote(req);
    } catch {
      return analyzeMock(req);
    }
  }
  return analyzeMock(req);
}

export type { AnalysisResult };
