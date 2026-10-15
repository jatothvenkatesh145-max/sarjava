import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { rateLimited, runInSandbox, validateInput, type JudgeResult } from "@/lib/execute.server";

export type { JudgeResult };

/** Compile/execute Java, Python or C in the Judge0 sandbox (server-side only). */
export const executeCode = createServerFn({ method: "POST" })
  .inputValidator((input: { language: string; code: string; stdin?: string }) => validateInput(input))
  .handler(async ({ data }): Promise<JudgeResult> => {
    const ip = getRequestHeader("cf-connecting-ip") || getRequestHeader("x-forwarded-for") || "anon";
    if (rateLimited(ip)) throw new Error("Too many runs — please wait a minute and try again.");
    return runInSandbox(data.language, data.code, data.stdin);
  });
