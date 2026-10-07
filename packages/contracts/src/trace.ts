import { z } from "zod";
import { PlanIdSchema, TraceEventIdSchema } from "./ids";

export const TraceEventTypeSchema = z.enum([
  "intake.received",
  "safety.evaluated",
  "clarification.requested",
  "model.plan.requested",
  "model.plan.received",
  "model.plan.skipped",
  "safety.override.applied",
  "search.requested",
  "search.completed",
  "search.skipped",
  "plan.persisted",
  "confirmation.required",
  "action.updated",
  "response.returned",
  "error"
]);

export const TraceStatusSchema = z.enum(["ok", "degraded", "error"]);

/**
 * Action-level observability. Deliberately excludes raw prompts and hidden
 * chain-of-thought: a trace event is a safe summary a reviewer can read.
 */
export const AgentTraceEventSchema = z.object({
  id: TraceEventIdSchema,
  planId: PlanIdSchema.nullable(),
  seq: z.number().int().nonnegative(),
  type: TraceEventTypeSchema,
  at: z.iso.datetime(),
  durationMs: z.number().int().nonnegative().nullable(),
  provider: z.string().max(60).nullable(),
  model: z.string().max(120).nullable(),
  tool: z.string().max(80).nullable(),
  status: TraceStatusSchema,
  summary: z.string().min(1).max(300)
});

export type TraceEventType = z.infer<typeof TraceEventTypeSchema>;
export type TraceStatus = z.infer<typeof TraceStatusSchema>;
export type AgentTraceEvent = z.infer<typeof AgentTraceEventSchema>;
