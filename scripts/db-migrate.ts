import { createDatabase } from "@homeops/persistence";
import { loadServerConfig } from "@homeops/api/config";
import { repoRoot } from "./lib/env";

const config = loadServerConfig(process.env, repoRoot);
const handle = createDatabase(config.databasePath);

const tables = handle.raw
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all() as Array<{ name: string }>;

console.log(`Schema ready at ${config.databasePath}`);
console.log(`Tables: ${tables.map((table) => table.name).join(", ")}`);
console.log("The bootstrap DDL is idempotent; drizzle-kit is configured for future migrations (pnpm db:generate).");
handle.close();
