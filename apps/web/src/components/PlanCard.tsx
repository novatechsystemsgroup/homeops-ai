"use client";

import { useEffect, useState } from "react";
import type { EvidenceWithUrl, HouseholdMember, PlanAction, RepairPlan } from "@homeops/contracts";
import { api } from "@/lib/api";
import { useVoiceRecorder } from "@/lib/use-voice-recorder";
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
  onNotice?: (message: string) => void;
}

export function PlanCard({ plan, members = [], readOnly = false, onAssign, onStatusChange, onNotice }: PlanCardProps) {
  const [pending, setPending] = useState<{ action: PlanAction; member: HouseholdMember } | null>(null);
  const [busy, setBusy] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceWithUrl[]>([]);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [recordingFor, setRecordingFor] = useState<string | null>(null);

  const recorder = useVoiceRecorder(({ blob, seconds }) => {
    const actionId = recordingFor;
    setRecordingFor(null);
    if (!actionId) return;
    void upload(actionId, "voice_note", blob, "voice-note-" + seconds + "s.webm");
  });

  useEffect(() => {
    let cancelled = false;
    void api
      .evidence(plan.id)
      .then((response) => {
        if (!cancelled) setEvidence(response.evidence);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [plan.id]);

  async function upload(actionId: string, kind: "photo" | "voice_note" | "note", file: File | Blob, filename: string, note?: string | null) {
    setUploadingFor(actionId);
    setEvidenceError(null);
    try {
      const response = await api.uploadEvidence(plan.id, { actionId, kind, file, filename, note: note ?? null });
      setEvidence((previous) => [response.evidence, ...previous]);
      onNotice?.(
        kind === "photo" ? "Photo attached as repair evidence." : kind === "voice_note" ? "Voice note attached." : "Note attached."
      );
    } catch (caught) {
      setEvidenceError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setUploadingFor(null);
    }
  }

  const removeEvidence = async (evidenceId: string) => {
    try {
      await api.deleteEvidence(evidenceId);
      setEvidence((previous) => previous.filter((item) => item.id !== evidenceId));
      onNotice?.("Attachment removed.");
    } catch (caught) {
      setEvidenceError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const saveNote = async (actionId: string) => {
    const text = (noteDrafts[actionId] ?? "").trim();
    if (text === "") return;
    await upload(actionId, "note", new Blob([text], { type: "text/plain" }), "note.txt", text.slice(0, 500));
    setNoteDrafts((previous) => ({ ...previous, [actionId]: "" }));
  };

  const confirmationsNeeded = plan.actions.filter((action) => action.requiresConfirmation && action.status !== "done");
  const isEmergency = plan.urgency === "emergency";

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
    <article className="card p-5" data-testid="plan-card">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" data-testid="plan-summary">
            {plan.issueSummary}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Plan {plan.id.slice(0, 8)} · created {new Date(plan.createdAt).toLocaleString("en-GB")}
            {plan.degraded ? " · deterministic fallback (model unavailable)" : ""}
            {plan.researchStatus === "skipped" ? " · research skipped" : ""}
            {plan.researchStatus === "unavailable" ? " · research unavailable" : ""}
            {evidence.length > 0 ? " · " + evidence.length + " attachment" + (evidence.length === 1 ? "" : "s") : ""}
          </p>
        </div>
        <span className={"badge border " + (URGENCY_STYLES[plan.urgency] ?? URGENCY_STYLES.monitor)} data-testid="plan-urgency">
          {plan.urgency.replace("_", " ")}
        </span>
      </header>

      <SafetyBanner urgency={plan.urgency} guidance={plan.safetyGuidance} />

      {isEmergency ? (
        <p className="mt-3 text-xs text-rose-200">
          Safety guidance above is written by the application, not generated by a model. HomeOps AI is a coordination tool, not an emergency
          service: if anyone is in danger, call 999.
        </p>
      ) : null}

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
        {plan.actions.map((action) => {
          const actionEvidence = evidence.filter((item) => item.actionId === action.id);
          const recording = recorder.recording && recordingFor === action.id;
          return (
            <li key={action.id} className="rounded-xl border border-slate-700/70 bg-slate-900/40 p-4" data-testid="plan-action">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="max-w-xl">
                  <p className="font-medium" data-testid="action-title">
                    {action.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">{action.rationale}</p>
                  <p className="mt-2 text-xs text-slate-400" data-testid="action-owner">
                    Owner: {action.ownerLabel}
                    {action.dueAt ? " · due " + new Date(action.dueAt).toLocaleString("en-GB") : ""}
                    {action.requiresConfirmation ? " · needs confirmation" : ""}
                    {actionEvidence.length > 0 ? " · " + actionEvidence.length + " attachment" + (actionEvidence.length === 1 ? "" : "s") : ""}
                  </p>
                </div>
                <span className={"badge " + (ACTION_STATUS[action.status] ?? ACTION_STATUS.open)} data-testid="action-status">
                  {action.status}
                </span>
              </div>

              {!readOnly ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {members.length > 0 && onAssign ? (
                    <select
                      aria-label={"Assign " + action.title}
                      data-testid="assign-select"
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
                      data-testid="toggle-action"
                      className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm hover:border-emerald-400 hover:text-emerald-300"
                      onClick={() => void onStatusChange(action.id, action.status === "done" ? "open" : "done")}
                    >
                      {action.status === "done" ? "Reopen" : "Mark done"}
                    </button>
                  ) : null}

                  <label className="cursor-pointer rounded-lg border border-slate-600 px-3 py-1.5 text-sm hover:border-sky-400">
                    📷 Photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      data-testid="evidence-photo"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) void upload(action.id, "photo", file, file.name || "photo.jpg");
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    data-testid="evidence-voice"
                    className={
                      "rounded-lg border px-3 py-1.5 text-sm " +
                      (recording ? "border-rose-400 bg-rose-500/20 text-rose-100" : "border-slate-600 hover:border-sky-400")
                    }
                    onClick={() => {
                      if (recording) {
                        recorder.stop();
                        return;
                      }
                      setRecordingFor(action.id);
                      void recorder.start();
                    }}
                    disabled={uploadingFor === action.id}
                  >
                    {recording ? "◉ Stop after " + recorder.seconds + "s" : "🎙 Voice note"}
                  </button>

                  <input
                    aria-label={"Note for " + action.title}
                    data-testid="evidence-note"
                    className="min-w-[10rem] flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm"
                    placeholder="Write a note (what the engineer said, the part number…)"
                    value={noteDrafts[action.id] ?? ""}
                    onChange={(event) => setNoteDrafts((previous) => ({ ...previous, [action.id]: event.target.value }))}
                  />
                  <button
                    type="button"
                    data-testid="evidence-save-note"
                    className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm hover:border-sky-400"
                    onClick={() => void saveNote(action.id)}
                    disabled={uploadingFor === action.id || (noteDrafts[action.id] ?? "").trim() === ""}
                  >
                    Save note
                  </button>
                </div>
              ) : null}

              {uploadingFor === action.id ? <p className="mt-2 text-xs text-slate-400">Uploading…</p> : null}

              {actionEvidence.length > 0 ? (
                <ul className="mt-3 space-y-2" data-testid="evidence-list">
                  {actionEvidence.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-700/60 bg-slate-950/40 p-2" data-testid="evidence-item">
                      {item.kind === "photo" ? (
                        <a href={api.evidenceUrl(item.id)} target="_blank" rel="noreferrer">
                          <img src={api.evidenceUrl(item.id)} alt={item.originalName ?? "Attached photo"} className="h-16 w-16 rounded object-cover" />
                        </a>
                      ) : null}
                      {item.kind === "voice_note" ? <audio controls src={api.evidenceUrl(item.id)} className="h-8" data-testid="evidence-audio" /> : null}
                      {item.kind === "note" ? <p className="max-w-md text-sm text-slate-200">{item.note}</p> : null}
                      <span className="text-[11px] text-slate-500">
                        {item.kind.replace("_", " ")} · {new Date(item.createdAt).toLocaleString("en-GB")} · {Math.max(1, Math.round(item.byteSize / 1024))} KB
                        {item.metadataStripped ? " · location data removed" : ""}
                      </span>
                      {!readOnly ? (
                        <button
                          type="button"
                          data-testid="evidence-delete"
                          className="ml-auto rounded-lg border border-slate-700 px-2 py-1 text-xs hover:border-rose-400 hover:text-rose-300"
                          onClick={() => void removeEvidence(item.id)}
                        >
                          Remove
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>

      {evidenceError ? <p className="mt-3 text-xs text-rose-300">{evidenceError}</p> : null}
      {recorder.error ? <p className="mt-2 text-xs text-amber-300">{recorder.error}</p> : null}

      {confirmationsNeeded.length > 0 && !readOnly ? (
        <section className="mt-4 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-100" data-testid="confirmation-list">
          <p className="font-semibold uppercase tracking-wide">Waiting for your confirmation</p>
          <ul className="mt-1 space-y-1">
            {confirmationsNeeded.map((action) => (
              <li key={action.id}>• {action.title}</li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-amber-200/80">
            Nothing external happens from this screen: no booking, no payment, no message leaves the app.
          </p>
        </section>
      ) : null}

      <SourceList sources={plan.sources} researchStatus={plan.researchStatus} />

      <ConfirmDialog
        open={pending !== null}
        title={pending ? 'Assign "' + pending.action.title + '" to ' + pending.member.displayName + "?" : ""}
        changes={pending ? ["owner: " + pending.action.ownerLabel + " → " + pending.member.displayName, "status: " + pending.action.status + " → assigned"] : []}
        onCancel={() => setPending(null)}
        onConfirm={() => void confirmAssignment()}
        busy={busy}
      />
    </article>
  );
}
