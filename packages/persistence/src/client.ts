import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export interface DatabaseHandle {
  readonly db: BetterSQLite3Database<typeof schema>;
  readonly raw: Database.Database;
  close(): void;
}

/**
 * Idempotent schema bootstrap. The DDL mirrors src/schema.ts; a test performs a
 * full ORM round-trip on every table so the two cannot drift unnoticed.
 */
const DDL = `
CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  is_synthetic INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS household_members (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  prefers_contact TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  issue_summary TEXT NOT NULL,
  urgency TEXT NOT NULL,
  safety_flags TEXT NOT NULL,
  safety_guidance TEXT NOT NULL,
  clarifying_questions TEXT NOT NULL,
  sources TEXT NOT NULL,
  research_status TEXT NOT NULL,
  degraded INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plan_actions (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  rationale TEXT NOT NULL,
  owner_member_id TEXT,
  owner_label TEXT NOT NULL,
  due_at TEXT,
  status TEXT NOT NULL,
  requires_confirmation INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS trace_events (
  id TEXT PRIMARY KEY,
  plan_id TEXT,
  seq INTEGER NOT NULL,
  type TEXT NOT NULL,
  at TEXT NOT NULL,
  duration_ms INTEGER,
  provider TEXT,
  model TEXT,
  tool TEXT,
  status TEXT NOT NULL,
  summary TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS preferences (
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (household_id, key)
);

CREATE INDEX IF NOT EXISTS idx_plan_actions_plan ON plan_actions(plan_id);
CREATE INDEX IF NOT EXISTS idx_trace_events_plan ON trace_events(plan_id);
CREATE INDEX IF NOT EXISTS idx_plans_household ON plans(household_id);
`;

export function createDatabase(dbPath: string): DatabaseHandle {
  const inMemory = dbPath === ":memory:" || dbPath.startsWith("file::memory:");
  if (!inMemory) {
    const absolute = resolve(dbPath);
    mkdirSync(dirname(absolute), { recursive: true });
    dbPath = absolute;
  }

  const raw = new Database(dbPath);
  raw.pragma("foreign_keys = ON");
  if (!inMemory) raw.pragma("journal_mode = WAL");
  raw.exec(DDL);

  const db = drizzle(raw, { schema });
  return {
    db,
    raw,
    close: () => raw.close()
  };
}
