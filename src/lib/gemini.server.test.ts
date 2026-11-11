import { equal, ok } from "node:assert/strict";
import { describe, it } from "node:test";

import { parseCommentary, type GeminiDiagnostic } from "./gemini.server";

const diagnostics: GeminiDiagnostic[] = [{
  line: 2,
  type: "Missing semicolon",
  severity: "error",
  message: "';' expected",
  explanation: "A statement needs a semicolon.",
  suggestion: "Add a semicolon.",
  originalLine: "int count = 1",
}];

describe("Gemini commentary response validation", () => {
  it("accepts bounded commentary aligned with supplied diagnostic lines", () => {
    const response = JSON.stringify({
      summary: "One syntax issue needs a small fix.",
      diagnostics: [{ line: 2, explanation: "The statement is not terminated.", correction: "Add a semicolon." }],
      improvements: ["Use a descriptive variable name."],
      correctedCode: "class Main { int count = 1; }",
    });
    equal(parseCommentary(response, diagnostics)?.diagnostics[0]?.line, 2);
  });
  it("rejects commentary that changes the compiler diagnostic line", () => {
    const response = JSON.stringify({ summary: "Advice", diagnostics: [{ line: 7, explanation: "Wrong line", correction: "Fix" }], improvements: [], correctedCode: "" });
    equal(parseCommentary(response, diagnostics), null);
  });
  it("rejects malformed provider text", () => {
    equal(parseCommentary("not json", diagnostics), null);
  });
});