"use client";

import { useCallback, useEffect, useState } from "react";
import type { MaintenanceCadence, MaintenanceTaskView } from "@homeops/contracts";
import { CADENCE_LABEL } from "@homeops/contracts";
import { api } from "@/lib/api";
import { ConfirmDialog } from "./ConfirmDialog";

const STATE_STYLES: Record<MaintenanceTaskView["state"], string> = {
  overdue: "border-rose-400/50 bg-rose-500/15 text-rose-100",
  due_soon: "border-amber-400/40 bg-amber-500/10 text-amber-100",
  scheduled: "border-slate-600/60 bg-slate-700/20 text-slate-300"
};

function dueLabel(task: MaintenanceTaskView): string {
  if (task.state === "overdue") {
    return "overdue by " + Math.abs(task.daysUntilDue) + (Math.abs(task.daysUntilDue) === 1 ? " day" : " days");
  }
  if (task.daysUntilDue === 0) return "due today";
  return "due in " + task.daysUntilDue + (task.daysUntilDue === 1 ? " day" : " days");
}

export interface MaintenancePanelProps {
  householdId: string;
  refreshToken?: number;
  onNotice?: (message: string) => void;
  onCountChange?: (dueCount: number) => void;
}

/** Recurring home upkeep: what is due, what was done, and when it comes back. */
export function MaintenancePanel({ householdId, refreshToken = 0, onNotice, onCountChange }: MaintenancePanelProps) {
  const [tasks, setTasks] = useState<MaintenanceTaskView[]>([]);
  const [title, setTitle] = useState("");
  const [cadence, setCadence] = useState<MaintenanceCadence>("annual");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<MaintenanceTaskView | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await api.maintenance(householdId);
      setTasks(response.tasks);
      onCountChange?.(response.tasks.filter((task) => task.state !== "scheduled").length);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [householdId, onCountChange]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const addTask = async () => {
    const value = title.trim();
    if (value.length < 3) return;
    setBusy(true);
    try {
      await api.createMaintenance({ householdId, title: value, cadence });
      setTitle("");
      await load();
      onNotice?.("Reminder added: " + value + " (" + CADENCE_LABEL[cadence] + ").");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const response = await api.completeMaintenance(pending.id, true);
      if (response.status === "ok" && response.task) {
        onNotice?.(response.task.title + " marked as done. Next due " + response.task.nextDueAt.slice(0, 10) + ".");
      }
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const dueCount = tasks.filter((task) => task.state !== "scheduled").length;

  return (
    <section className="card p-5" data-testid="maintenance-panel">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Home upkeep</h2>
          <p className="mt-1 text-xs text-slate-400">
            Recurring jobs with a cadence: the boiler service, the alarm test, the gutters. Completed once, scheduled again automatically.
          </p>
        </div>
        <span className={"badge " + (dueCount > 0 ? STATE_STYLES.overdue : STATE_STYLES.scheduled)} data-testid="maintenance-due-count">
          {dueCount} due
        </span>
      </header>

      {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}

      <ul className="mt-4 space-y-2" data-testid="maintenance-list">
        {tasks.map((task) => (
          <li key={task.id} className="rounded-xl border border-slate-700/70 bg-slate-900/40 p-3" data-testid="maintenance-task">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="max-w-[16rem]">
                <p className="text-sm font-medium" data-testid="maintenance-title">
                  {task.title}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {CADENCE_LABEL[task.cadence]} · next {task.nextDueAt.slice(0, 10)}
                  {task.lastCompletedAt ? " · last done " + task.lastCompletedAt.slice(0, 10) : " · never done"}
                </p>
                {task.instructions ? <p className="mt-1 text-xs text-slate-500">{task.instructions}</p> : null}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={"badge border " + STATE_STYLES[task.state]} data-testid="maintenance-state">
                  {dueLabel(task)}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    data-testid="maintenance-complete"
                    className="rounded-lg border border-slate-600 px-3 py-1 text-xs hover:border-emerald-400 hover:text-emerald-300"
                    onClick={() => setPending(task)}
                    disabled={busy}
                  >
                    Mark done
                  </button>
                  <button
                    type="button"
                    aria-label={"Delete " + task.title}
                    className="rounded-lg border border-slate-700 px-2 py-1 text-xs hover:border-rose-400 hover:text-rose-300"
                    onClick={() =>
                      void api
                        .deleteMaintenance(task.id)
                        .then(load)
                        .then(() => onNotice?.("Reminder removed: " + task.title + "."))
                    }
                    disabled={busy}
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
        {tasks.length === 0 ? <li className="text-xs text-slate-500">Nothing scheduled yet — add the first reminder below.</li> : null}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2" data-testid="maintenance-add">
        <input
          aria-label="New reminder"
          className="min-w-[10rem] flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          placeholder="e.g. Replace the smoke alarm batteries"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void addTask();
          }}
        />
        <select
          aria-label="How often"
          className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          value={cadence}
          onChange={(event) => setCadence(event.target.value as MaintenanceCadence)}
        >
          {(Object.keys(CADENCE_LABEL) as MaintenanceCadence[]).map((value) => (
            <option key={value} value={value}>
              {CADENCE_LABEL[value]}
            </option>
          ))}
        </select>
        <button
          type="button"
          data-testid="maintenance-add-submit"
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-60"
          onClick={() => void addTask()}
          disabled={busy || title.trim().length < 3}
        >
          Add reminder
        </button>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={pending ? 'Mark "' + pending.title + '" as done today?' : ""}
        changes={
          pending
            ? [
                "last done: " + (pending.lastCompletedAt?.slice(0, 10) ?? "never") + " -> " + new Date().toISOString().slice(0, 10),
                "next due: " + pending.nextDueAt.slice(0, 10) + " -> " + CADENCE_LABEL[pending.cadence]
              ]
            : []
        }
        onCancel={() => setPending(null)}
        onConfirm={() => void complete()}
        busy={busy}
      />
    </section>
  );
}
