import type { AgentTraceEvent } from "@homeops/contracts";

const STATUS_STYLES: Record<string, string> = {
  ok: "bg-emerald-500/15 text-emerald-300",
  degraded: "bg-amber-500/15 text-amber-300",
  error: "bg-rose-500/15 text-rose-300"
};

/** Phases keep the trace readable in a 60-second demo: what happened, in which order. */
const PHASES: Array<{ label: string; types: AgentTraceEvent["type"][] }> = [
  { label: "1 · Intake", types: ["intake.received"] },
  { label: "2 · Deterministic safety", types: ["safety.evaluated", "clarification.requested"] },
  { label: "3 · Model planning", types: ["model.plan.requested", "model.plan.received", "model.plan.skipped", "safety.override.applied"] },
  { label: "4 · Runtime research", types: ["search.requested", "search.completed", "search.skipped"] },
  { label: "5 · Persist and confirm", types: ["plan.persisted", "confirmation.required", "action.updated", "response.returned", "error"] }
];

export function TracePanel({
  events,
  meta
}: {
  events: AgentTraceEvent[];
  meta?: { modelProvider?: string; model?: string | null; searchProvider?: string } | null;
}) {
  const modelMs = events.reduce((total, event) => total + (event.type.startsWith("model.") ? event.durationMs ?? 0 : 0), 0);
  const searchMs = events.reduce((total, event) => total + (event.type.startsWith("search.") ? event.durationMs ?? 0 : 0), 0);
  const errors = events.filter((event) => event.status === "error").length;

  return (
    <aside className="card p-5" data-testid="trace-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Agent trace</h2>
        <span className="text-[11px] text-slate-400">
          {meta?.modelProvider ? `${meta.modelProvider}${meta.model ? ` · ${meta.model}` : ""} · research: ${meta.searchProvider}` : ""}
        </span>
      </div>

      {events.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">
          Run the scenario to see the action-level trace: intake, deterministic triage, model planning, research, persistence and confirmation.
        </p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-slate-400">
            <div className="rounded-lg border border-slate-700/70 p-2">
              <dt>model time</dt>
              <dd className="text-sm tabular-nums text-slate-200">{modelMs} ms</dd>
            </div>
            <div className="rounded-lg border border-slate-700/70 p-2">
              <dt>research time</dt>
              <dd className="text-sm tabular-nums text-slate-200">{searchMs} ms</dd>
            </div>
            <div className="rounded-lg border border-slate-700/70 p-2">
              <dt>failed steps</dt>
              <dd className="text-sm tabular-nums text-slate-200">{errors}</dd>
            </div>
          </dl>

          <div className="mt-4 space-y-4">
            {PHASES.map((phase) => {
              const phaseEvents = events.filter((event) => phase.types.includes(event.type));
              if (phaseEvents.length === 0) return null;
              return (
                <section key={phase.label}>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{phase.label}</h3>
                  <ol className="mt-2 space-y-2">
                    {phaseEvents.map((event) => (
                      <li key={event.id} className="border-l border-slate-700 pl-3" data-testid="trace-event">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-slate-200">{event.type}</span>
                          <span className={`badge ${STATUS_STYLES[event.status] ?? "bg-slate-600/20 text-slate-300"}`} data-testid="trace-status">
                            {event.status}
                          </span>
                          {event.durationMs !== null ? <span className="text-[11px] text-slate-500">{event.durationMs} ms</span> : null}
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{event.summary}</p>
                        {event.provider || event.model || event.tool ? (
                          <p className="text-[11px] text-slate-500">{[event.provider, event.model, event.tool].filter(Boolean).join(" · ")}</p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </section>
              );
            })}
          </div>
        </>
      )}

      <p className="mt-5 text-[11px] text-slate-500">
        Actions and tool calls only: no raw prompts, no hidden chain-of-thought, no credentials.
      </p>
    </aside>
  );
}
