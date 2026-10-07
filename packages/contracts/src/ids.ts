import { z } from "zod";

/** Branded-ish id primitives. All ids in HomeOps AI are UUID v4 strings. */
export const HouseholdIdSchema = z.uuid();
export const MemberIdSchema = z.uuid();
export const PlanIdSchema = z.uuid();
export const ActionIdSchema = z.uuid();
export const TraceEventIdSchema = z.uuid();

export type HouseholdId = z.infer<typeof HouseholdIdSchema>;
export type MemberId = z.infer<typeof MemberIdSchema>;
export type PlanId = z.infer<typeof PlanIdSchema>;
export type ActionId = z.infer<typeof ActionIdSchema>;
export type TraceEventId = z.infer<typeof TraceEventIdSchema>;
