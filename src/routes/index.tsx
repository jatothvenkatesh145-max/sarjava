import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Smart Java Error Analyzer" },
      {
        name: "description",
        content:
          "An intelligent Java code analysis system that identifies programming errors, explains why they occurred, and provides possible corrections in simple language.",
      },
      { property: "og:title", content: "Smart Java Error Analyzer" },
      {
        property: "og:description",
        content:
          "Detect, explain and correct Java errors line by line, with the reason each fault occurs and the fix that resolves it.",
      },
    ],
  }),
  component: Home,
});

const FEATURES = [
  {
    title: "Line-accurate detection",
    body: "Syntax, variable, data type, method and class faults are located to the exact line of your source.",
  },
  {
    title: "Plain-language explanation",
    body: "Each fault carries the analyzer message and a student-friendly reason for why it happened.",
  },
  {
    title: "Suggested corrections",
    body: "A corrected version of the line — and of the whole file — sits beside your original code.",
  },
];

const BENEFITS = [
  {
    title: "Learn the rule, not the patch",
    body: "Understanding why a semicolon or a type mismatch breaks a program is what stops it happening again.",
  },
  {
    title: "Built for coursework",
    body: "Upload the .java file you are submitting and read the faults before your tutor does.",
  },
  {
    title: "Honest about its limits",
    body: "This is a static inspection pass, not a Java compiler. Nothing is executed and nothing is guessed at runtime.",
  },
];

export default function Home() {
  return (
    <>
      <section className="border-b border-line">
        <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:py-20">
          <div className="grid items-end gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-7">
              <p className="mb-5 font-mono text-xs uppercase tracking-[0.22em] text-accent">
                Static analysis · student lab
              </p>
              <h1 className="max-w-[20ch] text-[clamp(2.5rem,6vw,4.75rem)] font-semibold leading-none tracking-tight text-balance">
                Smart Java Code Analyzer
              </h1>
              <p className="mt-4 font-mono text-sm uppercase tracking-[0.18em] text-ink-soft">
                Detect • Explain • Correct Java Errors
              </p>
              <p className="mt-5 max-w-[46ch] font-mono text-sm text-ink-soft text-pretty">
                An intelligent Java code analysis system that identifies programming errors,
                explains why they occurred, and provides possible corrections in simple language.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/analyzer"
                  className="inline-flex items-center gap-2 rounded-[8px] bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground ring-1 ring-accent-deep/40"
                >
                  Analyze Java Code <span className="font-mono text-xs">→</span>
                </Link>
                <Link
                  to="/analyzer"
                  search={{ upload: true }}
                  className="inline-flex items-center gap-2 rounded-[8px] px-5 py-2.5 text-sm font-medium text-ink ring-1 ring-ink/15 transition-colors hover:bg-ink/5"
                >
                  Upload Java File
                </Link>
              </div>
            </div>
            <div className="lg:col-span-5">
              <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[10px] bg-line ring-1 ring-black/5">
                <div className="bg-paper p-4">
                  <p className="font-mono text-2xl font-semibold leading-none">5</p>
                  <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                    Fault families
                  </p>
                </div>
                <div className="bg-paper p-4">
                  <p className="font-mono text-2xl font-semibold leading-none">1</p>
                  <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                    File type · .java
                  </p>
                </div>
                <div className="bg-paper p-4">
                  <p className="font-mono text-2xl font-semibold leading-none text-accent">0</p>
                  <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                    Code executed
                  </p>
                </div>
              </div>
              <p className="mt-3 font-mono text-[11px] text-ink-soft">
                Inspection pass · <span className="text-ink">no compilation, no runtime</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line">
        <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.22em] text-accent">Features</p>
          <h2 className="max-w-[40ch] text-3xl font-semibold tracking-tight text-balance">
            Everything a beginner needs to read their own errors
          </h2>
          <div className="mt-8 grid gap-px overflow-hidden rounded-[12px] bg-line ring-1 ring-black/5 md:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="bg-paper p-6">
                <span className="font-mono text-xs text-ink-soft">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-ink-soft text-pretty">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-line">
        <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.22em] text-accent">
            How it works
          </p>
          <h2 className="max-w-[40ch] text-3xl font-semibold tracking-tight text-balance">
            A lab-bench inspection of your source
          </h2>
          <div className="mt-8 grid gap-px overflow-hidden rounded-[12px] bg-line ring-1 ring-black/5 md:grid-cols-3">
            <div className="bg-paper p-6">
              <span className="font-mono text-xs text-ink-soft">01</span>
              <h3 className="mt-3 text-lg font-semibold">Paste or upload</h3>
              <p className="mt-2 text-sm text-ink-soft text-pretty">
                Drop a <span className="font-mono">.java</span> file into the editor. Line numbers
                and syntax stay legible at a glance.
              </p>
            </div>
            <div className="bg-paper p-6">
              <span className="font-mono text-xs text-ink-soft">02</span>
              <h3 className="mt-3 text-lg font-semibold">Inspect each line</h3>
              <p className="mt-2 text-sm text-ink-soft text-pretty">
                A static pass flags faults in the margin — no runtime, no compiler, no false
                confidence.
              </p>
            </div>
            <div className="bg-paper p-6">
              <span className="font-mono text-xs text-ink-soft">03</span>
              <h3 className="mt-3 text-lg font-semibold">Read the fix</h3>
              <p className="mt-2 text-sm text-ink-soft text-pretty">
                Each card explains the problem, why it happened, and the exact correction to apply.
              </p>
            </div>
          </div>
          <div className="mt-6">
            <Link
              to="/how-it-works"
              className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-accent"
            >
              Full process diagram →
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.22em] text-accent">Benefits</p>
          <div className="grid gap-px overflow-hidden rounded-[12px] bg-line ring-1 ring-black/5 md:grid-cols-3">
            {BENEFITS.map((b) => (
              <div key={b.title} className="bg-paper p-6">
                <h3 className="text-lg font-semibold">{b.title}</h3>
                <p className="mt-2 text-sm text-ink-soft text-pretty">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
