/**
 * Local analysis history.
 *
 * Mirrors the future `analyses` / `errors` tables: each record keeps the file
 * name, source, status and the detected faults so the same shape can be moved
 * to a database later without touching the UI.
 */

import { useCallback, useEffect, useState } from "react";
import type { AnalysisResult } from "@/lib/java-analyzer";

const KEY = "javabench.history.v1";
const EVENT = "javabench:history";

export interface HistoryRecord extends AnalysisResult {
  id: string;
  errorCount: number;
  warningCount: number;
}

function read(): HistoryRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HistoryRecord[]) : [];
  } catch {
    return [];
  }
}

function write(records: HistoryRecord[]) {
  window.localStorage.setItem(KEY, JSON.stringify(records.slice(0, 100)));
  window.dispatchEvent(new Event(EVENT));
}

export function saveAnalysis(result: AnalysisResult): HistoryRecord {
  const record: HistoryRecord = {
    ...result,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    errorCount: result.errors.filter((e) => e.severity === "error").length,
    warningCount: result.errors.filter((e) => e.severity === "warning").length,
  };
  write([record, ...read()]);
  return record;
}

export function clearHistory() {
  write([]);
}

export function useHistory() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);

  const refresh = useCallback(() => setRecords(read()), []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, [refresh]);

  return { records, refresh };
}

export interface HistoryStats {
  total: number;
  withErrors: number;
  valid: number;
  totalErrors: number;
  commonType: string;
  typeCounts: Array<{ type: string; count: number }>;
}

export function summarize(records: HistoryRecord[]): HistoryStats {
  const counts = new Map<string, number>();
  let totalErrors = 0;
  for (const r of records) {
    for (const e of r.errors) {
      totalErrors += 1;
      counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    }
  }
  const typeCounts = [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  return {
    total: records.length,
    withErrors: records.filter((r) => !r.valid).length,
    valid: records.filter((r) => r.valid).length,
    totalErrors,
    commonType: typeCounts[0]?.type ?? "—",
    typeCounts,
  };
}
