import { deepEqual, equal, ok } from "node:assert/strict";
import { describe, it } from "node:test";

import { geminiRequestSchema } from "./gemini.schema";

const diagnostic = {
  line: 2,
  type: "Missing semicolon",
  severity: "error" as const,
  message: "';' expected",
  explanation: "A statement needs a semicolon.",
  suggestion: "Add a semicolon.",
  originalLine: "int count = 1",
};

describe("Gemini request validation", () => {
  it("accepts diagnostics whose line is present in the submitted source", () => {
    ok(geminiRequestSchema.safeParse({ source: "class Main {\nint count = 1\n}", diagnostics: [diagnostic] }).success);
  });
  it("rejects diagnostics that point beyond the submitted source", () => {
    equal(geminiRequestSchema.safeParse({ source: "class Main {}", diagnostics: [diagnostic] }).success, false);
  });
  it("rejects oversized source before any provider request", () => {
    equal(geminiRequestSchema.safeParse({ source: "x".repeat(65 * 1024), diagnostics: [] }).success, false);
  });
  it("rejects unexpected request fields", () => {
    equal(geminiRequestSchema.safeParse({ source: "class Main {}", diagnostics: [], apiKey: "not-allowed" }).success, false);
  });
});