import { tavily } from "@tavily/core";
import type { SearchProvider } from "@homeops/agent-core";
import { normalizeSearchResults, type RawSearchResult } from "./normalize";

export interface TavilySearchProviderConfig {
  apiKey: string;
  timeoutMs?: number;
  /** Injectable for tests; defaults to the official @tavily/core client. */
  searchImpl?: (query: string, options: { limit: number }) => Promise<RawSearchResult[]>;
}

export const DEFAULT_TAVILY_BASE_URL = "https://api.tavily.com";

export function createTavilySearchProvider(config: TavilySearchProviderConfig): SearchProvider {
  const client = config.searchImpl ? null : tavily({ apiKey: config.apiKey });

  const runSearch = async (query: string, limit: number): Promise<RawSearchResult[]> => {
    if (config.searchImpl) return config.searchImpl(query, { limit });
    const response = await client!.search(query, { maxResults: limit, searchDepth: "basic", topic: "general" });
    return response.results as RawSearchResult[];
  };

  return {
    name: "tavily",
    description: "Tavily runtime research: current public sources with URLs.",

    async search(query, { limit }) {
      const results = await runSearch(query, limit);
      return normalizeSearchResults(results, new Date().toISOString(), limit);
    }
  };
}
