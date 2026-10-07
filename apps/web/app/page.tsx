const scenarios = [
  {
    href: "/alexa?scenario=boiler",
    title: "Boiler before the weekend",
    body: "A humming boiler, guests arriving on Saturday. The happy path: triage, plan, research, confirmation, status.",
    tone: "sky"
  },
  {
    href: "/alexa?scenario=gas",
    title: "Smell of gas",
    body: "The safety path: deterministic triage takes over, the model is skipped, and the emergency guidance is shown verbatim.",
    tone: "rose"
  }
];

const steps = [
  "You describe the problem in one sentence — the agent asks at most two clarifying questions.",
  "Deterministic rules decide the urgency floor; a language model can raise it, never lower it.",
  "The NVIDIA model on Nebius drafts the plan; Tavily adds current public sources with URLs.",
  "Every action that would contact a third party waits for your explicit confirmation.",
  "The plan is stored, so a later conversation resumes exactly where it stopped."
];

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="card p-6 sm:p-8">
        <p className="text-xs uppercase tracking-widest text-sky-400">Household operations agent</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">
          &ldquo;The boiler is making a noise and we have guests on Saturday&rdquo; becomes an executable plan.
        </h1>
        <p className="mt-4 max-w-2xl text-slate-300">
          HomeOps AI coordinates household repairs: it triages risk, plans with owners and deadlines, researches current options, and tracks the
          actions until they are done — across conversations.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {scenarios.map((scenario) => (
            <a
              key={scenario.href}
              href={scenario.href}
              data-testid={`start-${scenario.tone}`}
              className={`rounded-xl border p-4 transition-colors ${scenario.tone === "rose" ? "border-rose-400/40 hover:border-rose-300" : "border-sky-400/40 hover:border-sky-300"}`}
            >
              <p className="font-medium">{scenario.title}</p>
              <p className="mt-1 text-sm text-slate-300">{scenario.body}</p>
              <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">Start the demo →</p>
            </a>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <a className="rounded-lg border border-slate-600 px-4 py-2 hover:border-slate-400" href="/nebius">
            See the agent trace console
          </a>
          <a className="rounded-lg border border-slate-600 px-4 py-2 hover:border-slate-400" href="/alexa">
            Open the console without a scenario
          </a>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-medium">What happens in the first 90 seconds</h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-2">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm text-slate-300">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky-500/20 text-xs font-semibold text-sky-200">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="card p-5">
          <h3 className="font-medium">Two surfaces, one service layer</h3>
          <p className="mt-2 text-sm text-slate-300">
            The REST API used by this web app and the MCP server at <span className="font-mono text-xs">/mcp</span> call the same household service,
            so Alexa+ style clients get the identical behaviour.
          </p>
        </article>
        <article className="card p-5">
          <h3 className="font-medium">Open infrastructure</h3>
          <p className="mt-2 text-sm text-slate-300">
            NVIDIA open models served by Nebius Token Factory do the planning; Tavily provides current sources. Both are called at runtime and both
            are visible in the trace.
          </p>
        </article>
        <article className="card p-5">
          <h3 className="font-medium">Synthetic data only</h3>
          <p className="mt-2 text-sm text-slate-300">
            The demo household is fictional. Emergency numbers are UK public numbers, the safety copy is written by humans, and the app never claims
            to replace a professional.
          </p>
        </article>
      </section>
    </div>
  );
}
