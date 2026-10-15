import { createFileRoute } from "@tanstack/react-router";
import { rateLimited, runInSandbox, validateInput } from "@/lib/execute.server";

/** POST /api/execute { language: "java"|"python"|"c", source_code, stdin } */
export const Route = createFileRoute("/api/execute")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "anon";
        if (rateLimited(ip)) return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
        let input;
        try {
          input = validateInput(await request.json());
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "Invalid request" }, { status: 400 });
        }
        try {
          const r = await runInSandbox(input.language, input.code, input.stdin);
          return Response.json({
            language: input.language,
            status: r.status,
            stdout: r.stdout,
            stderr: r.stderr,
            compile_output: r.compileOutput,
            time: r.time,
            memory_kb: r.memoryKb,
            exit_code: r.exitCode,
          });
        } catch (e) {
          console.error("sandbox failure", e);
          return Response.json({ error: "Execution service unavailable" }, { status: 502 });
        }
      },
    },
  },
});
