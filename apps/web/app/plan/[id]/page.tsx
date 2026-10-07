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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <p className="text-sm text-slate-400">
          Resuming a plan in a new session: the agent recovers the stored plan and its open actions, which is the cross-session context the Alexa+
          experience is built on.
        </p>
        <PlanCard plan={envelope.plan} readOnly />
      </div>
      <TracePanel events={envelope.trace} />
    </div>
  );
}
