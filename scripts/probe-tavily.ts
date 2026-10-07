import { createTavilySearchProvider } from "@homeops/adapters-tavily";
import { fingerprint, heading, requireKey } from "./lib/env";

const apiKey = requireKey("TAVILY_API_KEY");
console.log(`Tavily probe\n  key: ${fingerprint(apiKey)}`);

heading("Runtime search");
const provider = createTavilySearchProvider({ apiKey });
const query = process.argv.slice(2).join(" ") || "boiler service Gas Safe registered engineer Bristol";
const started = Date.now();
const sources = await provider.search(query, { limit: 3, location: "Bristol" });
const latencyMs = Date.now() - started;

console.log(`  query   : ${query}`);
console.log(`  latency : ${latencyMs} ms`);
console.log(`  results : ${sources.length}`);
for (const source of sources) {
  console.log(`    - ${source.title}\n      ${source.url}`);
}

if (sources.length === 0) {
  console.error("\nPROBE FAILED — Tavily returned no usable sources.");
  process.exit(1);
}
console.log("\nPROBE OK — sources carry a URL and a retrieval timestamp.");
