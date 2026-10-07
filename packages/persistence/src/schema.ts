import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Source } from "@homeops/contracts";

export const households = sqliteTable("households", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  isSynthetic: integer("is_synthetic", { mode: "boolean" }).notNull(),
  createdAt: text("created_at").notNull()
});

export const householdMembers = sqliteTable("household_members", {
  id: text("id").primaryKey(),
  householdId: text("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  role: text("role").notNull(),
  prefersContact: text("prefers_contact").notNull()
});

export const plans = sqliteTable("plans", {
  id: text("id").primaryKey(),
  householdId: text("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  issueSummary: text("issue_summary").notNull(),
  urgency: text("urgency").notNull(),
  safetyFlags: text("safety_flags", { mode: "json" }).$type<string[]>().notNull(),
  safetyGuidance: text("safety_guidance", { mode: "json" }).$type<string[]>().notNull(),
  clarifyingQuestions: text("clarifying_questions", { mode: "json" }).$type<string[]>().notNull(),
  sources: text("sources", { mode: "json" }).$type<Source[]>().notNull(),
  researchStatus: text("research_status").notNull(),
  degraded: integer("degraded", { mode: "boolean" }).notNull(),
  createdAt: text("created_at").notNull()
});

export const planActions = sqliteTable("plan_actions", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  title: text("title").notNull(),
  rationale: text("rationale").notNull(),
  ownerMemberId: text("owner_member_id"),
  ownerLabel: text("owner_label").notNull(),
  dueAt: text("due_at"),
  status: text("status").notNull(),
  requiresConfirmation: integer("requires_confirmation", { mode: "boolean" }).notNull()
});

export const traceEvents = sqliteTable("trace_events", {
  id: text("id").primaryKey(),
  planId: text("plan_id"),
  seq: integer("seq").notNull(),
  type: text("type").notNull(),
  at: text("at").notNull(),
  durationMs: integer("duration_ms"),
  provider: text("provider"),
  model: text("model"),
  tool: text("tool"),
  status: text("status").notNull(),
  summary: text("summary").notNull()
});

export const preferences = sqliteTable(
  "preferences",
  {
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull()
  },
  (table) => [primaryKey({ columns: [table.householdId, table.key] })]
);
