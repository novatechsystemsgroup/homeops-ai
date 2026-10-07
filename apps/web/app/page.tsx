import { SCENARIOS } from "@/lib/scenarios";

const steps = [
  {
    title: "1 · Say what is wrong",
    body: "Speak or type anything about your home: heating, water, electrics, appliances, locks. No forms, no categories to pick."
  },
  {
    title: "2 · Answer at most two questions",
    body: "The agent asks only what changes the plan — for example whether there is any smell of gas."
  },
  {
    title: "3 · Get a plan and confirm",
    body: "Urgency, ordered actions, who does what, deadlines and the sources used. Nothing outside the app happens until you confirm."
  },
  {
    title: "4 · Come back later",
    body: "The plan is stored. Ask \"did we fix it?\" in a new conversation and the agent picks up where you stopped."
  }
];

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="card p-6 sm:p-8">
        <p className="text-xs uppercase tracking-widest text-sky-400">Household operations agent</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">
          Describe the problem at home. Get a plan you can actually finish.
        </h1>
        <p className="mt-4 max-w-2xl text-slate-300">
          HomeOps AI turns a spoken sentence into an executable plan: it triages safety, works out the constraints, finds current sources, and tracks
          the actions until they are done — across conversations.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a
            className="rounded-xl bg-sky-500 px-6 py-3 font-medium text-slate-950 hover:bg-sky-400"
            href="/alexa"
            data-testid="start-demo"
          >
            🎙 Talk to the agent
          </a>
          <a className="rounded-xl border border-slate-600 px-6 py-3 font-medium hover:border-slate-400" href="/nebius">
            See the agent trace console
          </a>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Voice input works in Chrome, Edge and Safari; you can always type instead. Replies are spoken by default.
        </p>
      </section>

      <section className="card p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-medium">Pick a starting point — or ask anything else</h2>
            <p className="mt-1 text-sm text-slate-400">
              These examples cover different trades and one emergency. The console accepts any description, in your own words.
            </p>
          </div>
          <a className="text-sm text-sky-300 hover:underline" href="/alexa">
            Open the console empty →
          </a>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SCENARIOS.map((scenario) => (
            <a
              key={scenario.id}
              href={`/alexa?scenario=${scenario.id}`}
              data-testid={`home-scenario-${scenario.id}`}
              className={`rounded-xl border p-4 transition-colors ${
                scenario.emergency ? "border-rose-400/40 hover:border-rose-300" : "border-slate-700 hover:border-sky-400"
              }`}
            >
              <p className="text-2xl" aria-hidden>
                {scenario.icon}
              </p>
              <p className="mt-2 font-medium">{scenario.label}</p>
              <p className="mt-1 text-xs text-slate-400">{scenario.hint}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-medium">What happens in the first 90 seconds</h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-2">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-3 text-sm text-slate-300">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky-500/20 text-xs font-semibold text-sky-200">
                {index + 1}
              </span>
              <span>
                <span className="font-medium text-slate-100">{step.title}</span>
                <span className="mt-1 block text-slate-400">{step.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="card p-5">
          <h3 className="font-medium">Safety decides first</h3>
          <p className="mt-2 text-sm text-slate-300">
            Gas, smoke, water near electrics and vulnerable occupants are handled by deterministic rules. The model can raise the urgency, never lower
            it, and emergencies skip the model entirely.
          </p>
        </article>
        <article className="card p-5">
          <h3 className="font-medium">Open infrastructure</h3>
          <p className="mt-2 text-sm text-slate-300">
            NVIDIA Nemotron models on Nebius Token Factory do the planning; Tavily provides current public sources. Both are called at runtime and both
            are visible in the trace.
          </p>
        </article>
        <article className="card p-5">
          <h3 className="font-medium">Nothing silent, nothing fake</h3>
          <p className="mt-2 text-sm text-slate-300">
            The demo household is fictional, every external action waits for confirmation, and the app never claims to replace a qualified
            professional.
          </p>
        </article>
      </section>
    </div>
  );
}
