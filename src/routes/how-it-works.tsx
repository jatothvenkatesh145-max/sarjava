import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How the analysis works — Smart Java Error Analyzer" },
      {
        name: "description",
        content:
          "Six steps from Java source to a corrected program: enter code, analyze, detect, locate, explain, suggest.",
      },
      { property: "og:title", content: "How the analysis works — Smart Java Error Analyzer" },
      {
        property: "og:description",
        content: "The inspection pipeline behind Smart Java Error Analyzer, step by step.",
      },
    ],
  }),
  component: HowItWorks,
});

const STEPS = [
  { n: "01", title: "Enter Java code", body: "Paste source into the editor or upload a .java file. The file name is kept for class-name checks." },
  { n: "02", title: "Analyze code", body: "The source is stripped of comments and string literals, then scanned line by line." },
  { n: "03", title: "Detect errors", body: "Syntax, variable, data type, method and class rules run over each statement." },
  { n: "04", title: "Find error location", body: "Every finding is pinned to a line number and marked in the editor margin." },
  { n: "05", title: "Explain error", body: "The analyzer message is translated into a plain-language reason a beginner can act on." },
  { n: "06", title: "Suggest correction", body: "A corrected line is produced where possible, and combined into a corrected file." },
];

const LAYERS = [
  "Frontend — React / TanStack Start",
  "API — POST /api/analyze",
  "Java backend (planned)",
  "Java code analyzer",
  "Error detection",
  "Explanation engine",
  "Correction suggestions",
  "Database",
];

function HowItWorks() {
  return (
    <>
      <section className="border-b border-line">
        <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.22em] text-accent">
            How it works
          </p>
          <h1 className="max-w-[24ch] text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-tight tracking-tight text-balance">
            From source to correction in six passes
          </h1>
          <div className="mt-10 grid gap-px overflow-hidden rounded-[12px] bg-line ring-1 ring-black/5 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="bg-paper p-6">
                <span className="font-mono text-xs text-accent">{s.n}</span>
                <h2 className="mt-3 text-lg font-semibold">{s.title}</h2>
                <p className="mt-2 text-sm text-ink-soft text-pretty">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.22em] text-accent">
            Architecture
          </p>
          <h2 className="max-w-[46ch] text-2xl font-semibold tracking-tight text-balance">
            The interface is ready for a Java analysis engine behind an API
          </h2>
          <p className="mt-3 max-w-[60ch] text-sm text-ink-soft text-pretty">
            Today the detection rules run in the browser as a demonstration analyzer. The service
            layer already speaks to <span className="font-mono">POST /api/analyze</span>, so a real
            Java backend can replace the demo without changing any screen.
          </p>
          <ol className="mt-8 max-w-xl space-y-2">
            {LAYERS.map((layer, i) => (
              <li key={layer}>
                <div className="rounded-[10px] bg-card px-4 py-3 font-mono text-[13px] ring-1 ring-black/5">
                  {layer}
                </div>
                {i < LAYERS.length - 1 ? (
                  <div className="py-1 pl-6 font-mono text-xs text-accent">↓</div>
                ) : null}
              </li>
            ))}
          </ol>
          <Link
            to="/analyzer"
            className="mt-10 inline-flex rounded-[8px] bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground"
          >
            Try the analyzer
          </Link>
        </div>
      </section>
    </>
  );
}
