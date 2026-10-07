import { tavily } from "@tavily/core";
import type { SearchProvider } from "@homeops/agent-core";
import { normalizeSearchResults, type RawSearchResult } from "./normalize";

export interface TavilySearchProviderConfig {
  apiKey: string;
  timeoutMs?: number;
  /** Injectable for tests; defaults to the official @tavily/core client. */
  searchImpl?: (query: string, options: { limit: number; includeDomains?: string[]; excludeDomains?: string[] }) => Promise<RawSearchResult[]>;
}

export const DEFAULT_TAVILY_BASE_URL = "https://api.tavily.com";

export function createTavilySearchProvider(config: TavilySearchProviderConfig): SearchProvider {
  const client = config.searchImpl ? null : tavily({ apiKey: config.apiKey });

  const runSearch = async (
    query: string,
    limit: number,
    includeDomains?: string[],
    excludeDomains?: string[]
  ): Promise<RawSearchResult[]> => {
    if (config.searchImpl) return config.searchImpl(query, { limit, includeDomains, excludeDomains });
    const response = await client!.search(query, {
      maxResults: limit,
      searchDepth: "basic",
      topic: "general",
      ...(includeDomains && includeDomains.length > 0 ? { includeDomains } : {}),
      ...(excludeDomains && excludeDomains.length > 0 ? { excludeDomains } : {})
    });
    return response.results as RawSearchResult[];
  };

  return {
    name: "tavily",
    description: "Tavily runtime research: current public sources with URLs.",

    async search(query, { limit, includeDomains, excludeDomains }) {
      let results = await runSearch(query, limit, includeDomains, excludeDomains);
      // A domain filter that is too narrow must not remove research entirely:
      // retry once unrestricted so the plan can still cite something real.
      if (results.length === 0 && includeDomains && includeDomains.length > 0) {
        results = await runSearch(query, limit, undefined, excludeDomains);
      }
      return normalizeSearchResults(results, new Date().toISOString(), limit);
    }
  };
}
