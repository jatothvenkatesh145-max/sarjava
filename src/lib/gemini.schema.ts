import { z } from "zod";

export const geminiRequestSchema = z.object({
  source: z.string().min(1).max(64 * 1024),
  diagnostics: z.array(z.object({
    line: z.number().int().positive(),
    type: z.string().max(100),
    severity: z.enum(["error", "warning"]),
    message: z.string().max(1000),
    explanation: z.string().max(1600),
    suggestion: z.string().max(1600),
    originalLine: z.string().max(1000),
  }).strict()).max(20),
}).strict().superRefine((input, context) => {
  const lineCount = input.source.split("\n").length;
  input.diagnostics.forEach((diagnostic, index) => {
    if (diagnostic.line > lineCount) {
      context.addIssue({ code: "custom", path: ["diagnostics", index, "line"], message: "Diagnostic line is outside the source." });
    }
  });
});

export type GeminiRequest = z.infer<typeof geminiRequestSchema>;