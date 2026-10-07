import type { AgentTraceEvent } from "@homeops/contracts";

const STATUS_STYLES: Record<string, string> = {
  ok: "bg-emerald-500/15 text-emerald-300",
  degraded: "bg-amber-500/15 text-amber-300",
  error: "bg-rose-500/15 text-rose-300"
};

export function TracePanel({ events, meta }: { events: AgentTraceEvent[]; meta?: { modelProvider?: string; model?: string | null; searchProvider?: string } | null }) {
  return (
    <aside className="card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Agent trace</h2>
        {meta?.modelProvider ? (
          <span className="text-[11px] text-slate-400">
            {meta.modelProvider}
            {meta.model ? ` · ${meta.model}` : ""} · search: {meta.searchProvider}
          </span>
        ) : null}
      </div>

      {events.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">
          Run the scenario to see the action-level trace: intake, deterministic triage, model planning, research and confirmation.
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {events.map((event) => (
            <li key={event.id} className="border-l border-slate-700 pl-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-slate-200">{event.type}</span>
                <span className={`badge ${STATUS_STYLES[event.status] ?? "bg-slate-600/20 text-slate-300"}`}>{event.status}</span>
                {event.durationMs !== null ? <span className="text-[11px] text-slate-500">{event.durationMs} ms</span> : null}
              </div>
              <p className="mt-1 text-xs text-slate-400">{event.summary}</p>
              {event.provider || event.model ? (
                <p className="text-[11px] text-slate-500">
                  {[event.provider, event.model, event.tool].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      <p className="mt-5 text-[11px] text-slate-500">
        The trace shows actions and tool calls only. Raw prompts and hidden chain-of-thought are never exposed.
      </p>
    </aside>
  );
}
