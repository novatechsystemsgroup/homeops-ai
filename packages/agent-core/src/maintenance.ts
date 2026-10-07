import type { MaintenanceCadence, MaintenanceTask, MaintenanceTaskView } from "@homeops/contracts";
import { CADENCE_MONTHS } from "@homeops/contracts";

/** Month arithmetic that survives month-end (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(iso: string, months: number): string {
  const date = new Date(iso);
  const day = date.getUTCDate();
  const target = new Date(date.getTime());
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + months);
  const daysInTargetMonth = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, daysInTargetMonth));
  return target.toISOString();
}

export function nextDueFrom(cadence: MaintenanceCadence, from: string): string {
  return addMonths(from, CADENCE_MONTHS[cadence]);
}

const DUE_SOON_DAYS = 14;

export function daysUntil(iso: string, now: Date): number {
  const diff = new Date(iso).getTime() - now.getTime();
  return Math.floor(diff / 86_400_000);
}

/** Adds what the UI and the assistant need: overdue, due soon, or comfortably scheduled. */
export function viewOf(task: MaintenanceTask, now: Date): MaintenanceTaskView {
  const daysUntilDue = daysUntil(task.nextDueAt, now);
  const state = daysUntilDue < 0 ? "overdue" : daysUntilDue <= DUE_SOON_DAYS ? "due_soon" : "scheduled";
  return { ...task, state, daysUntilDue };
}

export function sortByUrgency(views: MaintenanceTaskView[]): MaintenanceTaskView[] {
  const rank: Record<MaintenanceTaskView["state"], number> = { overdue: 0, due_soon: 1, scheduled: 2 };
  return [...views].sort((a, b) => rank[a.state] - rank[b.state] || a.daysUntilDue - b.daysUntilDue);
}

export function dueOrSoon(views: MaintenanceTaskView[]): MaintenanceTaskView[] {
  return views.filter((view) => view.state !== "scheduled");
}

/** Starter upkeep for a new household: one safety check, one service, one seasonal job. */
export function buildStarterMaintenance(householdId: string, now: Date): MaintenanceTask[] {
  const nowIso = now.toISOString();
  const monthAgo = addMonths(nowIso, -1);
  const sixWeeks = new Date(now.getTime() + 42 * 86_400_000).toISOString();
  const fourMonths = new Date(now.getTime() + 122 * 86_400_000).toISOString();

  const base = { householdId, sourcePlanId: null, createdAt: nowIso, lastCompletedAt: null } as const;

  return [
    {
      ...base,
      id: "b1a7c0de-0001-4a11-9c01-000000000001",
      title: "Test the smoke and CO alarms",
      instructions: "Press the test button on every alarm. Replace the batteries if the chirp continues, and never cover an alarm.",
      category: "safety",
      cadence: "monthly",
      // Last month's date makes it overdue straight away, which is the honest state of most homes.
      nextDueAt: monthAgo
    },
    {
      ...base,
      id: "b1a7c0de-0002-4a11-9c01-000000000002",
      title: "Book the annual boiler service",
      instructions: "Gas Safe registered engineer only. Keep the service record: it protects the warranty and catches problems before winter.",
      category: "heating",
      cadence: "annual",
      nextDueAt: sixWeeks
    },
    {
      ...base,
      id: "b1a7c0de-0003-4a11-9c01-000000000003",
      title: "Clear the gutters and check the roof",
      instructions: "Blocked gutters cause damp. Stay off ladders if you are unsure: this is a job for a contractor.",
      category: "building",
      cadence: "annual",
      nextDueAt: fourMonths
    }
  ];
}
