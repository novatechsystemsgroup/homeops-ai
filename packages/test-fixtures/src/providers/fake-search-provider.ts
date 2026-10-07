import type { SearchProvider } from "@homeops/agent-core";
import type { Source } from "@homeops/contracts";
import { FIXTURE_SOURCES } from "../search-results";

/** Deterministic stand-in for Tavily, used when SEARCH_PROVIDER=fake. */
export function createFakeSearchProvider(options: { sources?: Source[]; fail?: boolean; delayMs?: number } = {}): SearchProvider {
  return {
    name: "fake-search",
    description: "Deterministic fixture research provider (no network calls).",
    async search(_query, { limit, includeDomains }) {
      if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      if (options.fail) throw new Error("fake search provider: simulated failure");
      const sources = options.sources ?? FIXTURE_SOURCES;
      if (includeDomains && includeDomains.length > 0) {
        const matching = sources.filter((source) => includeDomains.some((domain) => source.url.includes(domain)));
        // Mirrors the real adapter: an over-narrow filter falls back to unfiltered results.
        if (matching.length > 0) return matching.slice(0, limit);
      }
      return sources.slice(0, limit);
    }
  };
}
