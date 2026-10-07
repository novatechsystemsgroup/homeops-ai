"use client";

import { useState } from "react";
import type { HouseholdMember, PlanAction, RepairPlan } from "@homeops/contracts";
import { ConfirmDialog } from "./ConfirmDialog";
import { SafetyBanner } from "./SafetyBanner";
import { SourceList } from "./SourceList";

const URGENCY_STYLES: Record<string, string> = {
  emergency: "border-rose-400/60 bg-rose-500/15 text-rose-100",
  urgent: "border-amber-400/50 bg-amber-500/10 text-amber-100",
  needs_attention: "border-sky-400/40 bg-sky-500/10 text-sky-100",
  monitor: "border-slate-500/40 bg-slate-600/10 text-slate-200"
};

const ACTION_STATUS: Record<string, string> = {
  open: "bg-slate-600/20 text-slate-300",
  assigned: "bg-sky-500/15 text-sky-300",
  done: "bg-emerald-500/15 text-emerald-300"
};

export interface PlanCardProps {
  plan: RepairPlan;
  members?: HouseholdMember[];
  readOnly?: boolean;
  onAssign?: (actionId: string, ownerMemberId: string) => Promise<void> | void;
  onStatusChange?: (actionId: string, status: PlanAction["status"]) => Promise<void> | void;
}

export function PlanCard({ plan, members = [], readOnly = false, onAssign, onStatusChange }: PlanCardProps) {
  const [pending, setPending] = useState<{ action: PlanAction; member: HouseholdMember } | null>(null);
  const [busy, setBusy] = useState(false);

  const confirmAssignment = async () => {
    if (!pending || !onAssign) return;
    setBusy(true);
    try {
      await onAssign(pending.action.id, pending.member.id);
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  return (
    <article className="card p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{plan.issueSummary}</h2>
          <p className="mt-1 text-xs text-slate-400">
            Plan {plan.id.slice(0, 8)} · created {new Date(plan.createdAt).toLocaleString("en-GB")}
            {plan.degraded ? " · deterministic fallback (model unavailable)" : ""}
            {plan.researchStatus === "skipped" ? " · research skipped" : ""}
          </p>
        </div>
        <span className={`badge border ${URGENCY_STYLES[plan.urgency] ?? URGENCY_STYLES.monitor}`}>{plan.urgency.replace("_", " ")}</span>
      </header>

      <SafetyBanner urgency={plan.urgency} guidance={plan.safetyGuidance} />

      {plan.clarifyingQuestions.length > 0 ? (
        <section className="mt-4 rounded-xl border border-sky-400/40 bg-sky-500/10 p-4 text-sm text-sky-100">
          <p className="text-xs font-semibold uppercase tracking-wide">Before the plan</p>
          <ul className="mt-2 space-y-1">
            {plan.clarifyingQuestions.map((question) => (
              <li key={question}>• {question}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <ol className="mt-4 space-y-3">
        {plan.actions.map((action) => (
          <li key={action.id} className="rounded-xl border border-slate-700/70 bg-slate-900/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="max-w-xl">
                <p className="font-medium">{action.title}</p>
                <p className="mt-1 text-sm text-slate-400">{action.rationale}</p>
                <p className="mt-2 text-xs text-slate-400">
                  Owner: {action.ownerLabel}
                  {action.dueAt ? ` · due ${new Date(action.dueAt).toLocaleString("en-GB")}` : ""}
                  {action.requiresConfirmation ? " · needs confirmation" : ""}
                </p>
              </div>
              <span className={`badge ${ACTION_STATUS[action.status] ?? ACTION_STATUS.open}`}>{action.status}</span>
            </div>

            {!readOnly ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {members.length > 0 && onAssign ? (
                  <select
                    className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm"
                    defaultValue=""
                    onChange={(event) => {
                      const member = members.find((candidate) => candidate.id === event.target.value);
                      if (member) setPending({ action, member });
                      event.target.value = "";
                    }}
                  >
                    <option value="">Assign to…</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.displayName}
                      </option>
                    ))}
                  </select>
                ) : null}
                {onStatusChange ? (
                  <button
                    type="button"
                    className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm hover:border-emerald-400 hover:text-emerald-300"
                    onClick={() => void onStatusChange(action.id, action.status === "done" ? "open" : "done")}
                  >
                    {action.status === "done" ? "Reopen" : "Mark done"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ol>

      <SourceList sources={plan.sources} researchStatus={plan.researchStatus} />

      <ConfirmDialog
        open={pending !== null}
        title={pending ? `Assign "${pending.action.title}" to ${pending.member.displayName}?` : ""}
        changes={pending ? [`owner: ${pending.action.ownerLabel} → ${pending.member.displayName}`, `status: ${pending.action.status} → assigned`] : []}
        onCancel={() => setPending(null)}
        onConfirm={() => void confirmAssignment()}
        busy={busy}
      />
    </article>
  );
}
