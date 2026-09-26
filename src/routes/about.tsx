import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About the project — Smart Java Error Analyzer" },
      {
        name: "description",
        content:
          "Smart Java Code Error Detection and Explanation System: problem statement, objectives, methodology, technologies and future scope.",
      },
      { property: "og:title", content: "About the project — Smart Java Error Analyzer" },
      {
        property: "og:description",
        content:
          "An academic project to help students identify, understand and correct common Java programming errors.",
      },
    ],
  }),
  component: About,
});

const SECTIONS = [
  {
    title: "Problem statement",
    body: "Beginners meet Java compiler messages that name a symbol and a line but rarely say what went wrong in words a first-year student understands. The result is trial-and-error editing instead of learning.",
  },
  {
    title: "Objectives",
    body: "Detect common Java faults, report the exact line, classify the fault, explain the cause in simple language, and propose a correction that can be compared with the original code.",
  },
  {
    title: "Methodology",
    body: "The source is normalised (comments and string literals removed), then scanned line by line against rule groups for syntax, variables, data types, methods and class structure. Findings are collected, sorted by line, and applied to build a corrected version of the file.",
  },
  {
    title: "Technologies used",
    body: "React with TanStack Start and TypeScript for the interface, Tailwind CSS for the design system, and a service layer prepared for a Java analysis backend exposed at POST /api/analyze.",
  },
  {
    title: "Future scope",
    body: "Replace the demonstration rules with a real Java parser on the server, persist analyses and users in a database, add classroom accounts for tutors, and extend explanations with worked examples.",
  },
];

function About() {
  return (
    <section>
      <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.22em] text-accent">
          About the project
        </p>
        <h1 className="max-w-[28ch] text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-tight tracking-tight text-balance">
          Smart Java Code Error Detection and Explanation System
        </h1>
        <p className="mt-5 max-w-[60ch] font-mono text-sm text-ink-soft text-pretty">
          Objective: to develop a system that helps students identify, understand, and correct
          common Java programming errors.
        </p>

        <div className="mt-10 grid gap-px overflow-hidden rounded-[12px] bg-line ring-1 ring-black/5 md:grid-cols-2">
          {SECTIONS.map((s) => (
            <div key={s.title} className="bg-paper p-6">
              <h2 className="text-lg font-semibold">{s.title}</h2>
              <p className="mt-2 text-sm text-ink-soft text-pretty">{s.body}</p>
            </div>
          ))}
          <div className="bg-paper p-6">
            <h2 className="text-lg font-semibold">Scope note</h2>
            <p className="mt-2 text-sm text-ink-soft text-pretty">
              Smart Java Error Analyzer performs static inspection in the browser. It is not a Java compiler, it
              never executes submitted code, and analyses are stored only on this device until a
              backend database is connected.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
