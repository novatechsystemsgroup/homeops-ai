import { z } from "zod";
import { HouseholdIdSchema, PlanIdSchema } from "./ids";

export const MaintenanceCadenceSchema = z.enum(["monthly", "quarterly", "biannual", "annual"]);
export const MaintenanceStateSchema = z.enum(["overdue", "due_soon", "scheduled"]);
export const MaintenanceCategorySchema = z.enum(["safety", "heating", "plumbing", "appliance", "building", "other"]);

/** A recurring piece of home upkeep: the boiler service, the smoke alarm test, the gutters. */
export const MaintenanceTaskSchema = z.object({
  id: z.uuid(),
  householdId: HouseholdIdSchema,
  title: z.string().min(1).max(120),
  instructions: z.string().max(400),
  category: MaintenanceCategorySchema,
  cadence: MaintenanceCadenceSchema,
  nextDueAt: z.iso.datetime(),
  lastCompletedAt: z.iso.datetime().nullable(),
  /** Set when the task was suggested by a finished plan. */
  sourcePlanId: PlanIdSchema.nullable(),
  createdAt: z.iso.datetime()
});

/** A task plus what the UI needs to show: how urgent it is and how long is left. */
export const MaintenanceTaskViewSchema = MaintenanceTaskSchema.extend({
  state: MaintenanceStateSchema,
  daysUntilDue: z.number().int()
});

export const CreateMaintenanceTaskSchema = z.object({
  householdId: HouseholdIdSchema,
  title: z.string().min(3).max(120),
  instructions: z.string().max(400).optional(),
  category: MaintenanceCategorySchema.optional(),
  cadence: MaintenanceCadenceSchema,
  /** Defaults to now: the task becomes due immediately. */
  nextDueAt: z.iso.datetime().nullable().optional(),
  sourcePlanId: PlanIdSchema.nullable().optional()
});

export const CompleteMaintenanceTaskSchema = z.object({
  confirm: z.boolean()
});

/** How many months each cadence adds. Kept here so API, UI and tests agree. */
export const CADENCE_MONTHS: Record<z.infer<typeof MaintenanceCadenceSchema>, number> = {
  monthly: 1,
  quarterly: 3,
  biannual: 6,
  annual: 12
};

export const CADENCE_LABEL: Record<z.infer<typeof MaintenanceCadenceSchema>, string> = {
  monthly: "every month",
  quarterly: "every 3 months",
  biannual: "every 6 months",
  annual: "every 12 months"
};

export type MaintenanceCadence = z.infer<typeof MaintenanceCadenceSchema>;
export type MaintenanceState = z.infer<typeof MaintenanceStateSchema>;
export type MaintenanceCategory = z.infer<typeof MaintenanceCategorySchema>;
export type MaintenanceTask = z.infer<typeof MaintenanceTaskSchema>;
export type MaintenanceTaskView = z.infer<typeof MaintenanceTaskViewSchema>;
export type CreateMaintenanceTask = z.infer<typeof CreateMaintenanceTaskSchema>;
