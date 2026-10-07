import { loadRepoEnv, loadServerConfig } from "@homeops/api/config";
import { createContainer } from "@homeops/api/container";
import { createLogger } from "@homeops/api";
import { BOILER_DESCRIPTION } from "@homeops/test-fixtures";
import { heading, repoRoot } from "./lib/env";

loadRepoEnv(repoRoot);
const config = loadServerConfig(process.env, repoRoot);
const container = createContainer(config, createLogger("error"));

const description = process.argv.slice(2).join(" ").trim() || BOILER_DESCRIPTION;
const household = await container.ensureDemoHousehold();

console.log(`demo:plan — model=${container.model.name}${container.model.planModel ? ` (${container.model.planModel})` : ""}, search=${container.search.name}`);
console.log(`household: ${household.name} (${household.city})`);
console.log(`report   : ${description}`);

const started = Date.now();
const { plan, trace, clarificationRequired } = await container.service.createPlan({ householdId: household.id, description });
const elapsed = Date.now() - started;

heading("Plan");
console.log(`  id        : ${plan.id}`);
console.log(`  urgency   : ${plan.urgency}`);
console.log(`  degraded  : ${plan.degraded}`);
console.log(`  research  : ${plan.researchStatus} (${plan.sources.length} sources)`);
console.log(`  summary   : ${plan.issueSummary}`);
if (clarificationRequired) console.log(`  questions : ${plan.clarifyingQuestions.join(" | ")}`);
for (const action of plan.actions) {
  console.log(`  [${action.status}] ${action.title} — owner ${action.ownerLabel}${action.requiresConfirmation ? " (needs confirmation)" : ""}`);
}

heading("Trace");
for (const event of trace) {
  const timing = event.durationMs === null ? "" : ` (${event.durationMs} ms)`;
  console.log(`  ${String(event.seq).padStart(2, "0")} ${event.type.padEnd(24)} ${event.status.padEnd(8)}${timing} ${event.summary}`);
}
console.log(`\nelapsed: ${elapsed} ms — full JSON below\n`);
console.log(JSON.stringify({ plan, trace }, null, 2));

container.close();
