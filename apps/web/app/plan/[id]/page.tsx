import { notFound } from "next/navigation";
import { API_BASE, type PlanEnvelope } from "@/lib/api";
import { PlanCard } from "@/components/PlanCard";
import { TracePanel } from "@/components/TracePanel";

async function loadPlan(planId: string): Promise<PlanEnvelope | null> {
  const response = await fetch(`${API_BASE}/api/plans/${planId}`, { cache: "no-store" });
  if (!response.ok) return null;
  return (await response.json()) as PlanEnvelope;
}

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const envelope = await loadPlan(id);
  if (!envelope) notFound();

  const open = envelope.openActions.length;
  const done = envelope.plan.actions.length - open;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <section className="card p-4 text-sm text-slate-300">
          <p>
            Resuming a plan in a new session: the agent recovers the stored plan and its open actions. This is the cross-session context the Alexa+
            experience is built on.
          </p>
          <p className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="badge bg-slate-600/20 text-slate-200" data-testid="resume-open">{open} open</span>
            <span className="badge bg-emerald-500/15 text-emerald-300">{done} done</span>
            <a className="rounded-lg border border-slate-600 px-3 py-1 hover:border-slate-400" href="/alexa">
              Back to the console
            </a>
          </p>
        </section>
        <PlanCard plan={envelope.plan} readOnly />
      </div>
      <TracePanel events={envelope.trace} />
    </div>
  );
}
