import { createDatabase, createHouseholdStore, seedDemoHousehold, DEMO_HOUSEHOLD } from "@homeops/persistence";
import { loadServerConfig } from "@homeops/api/config";
import { repoRoot } from "./lib/env";

const config = loadServerConfig(process.env, repoRoot);
const handle = createDatabase(config.databasePath);
const households = createHouseholdStore(handle);

const household = await seedDemoHousehold(households, new Date().toISOString());
console.log(`Seeded synthetic household "${household.name}" (${household.members.length} members) at ${config.databasePath}`);
console.log(`Household id: ${DEMO_HOUSEHOLD.id}`);
handle.close();
