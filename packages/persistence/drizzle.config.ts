import { defineConfig } from "drizzle-kit";

/**
 * Schema source of truth for code review and for future migrations.
 * Runtime bootstrap is an idempotent DDL script (see src/client.ts) so the demo
 * never depends on a code-generation step.
 */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema.ts",
  out: "./drizzle"
});
