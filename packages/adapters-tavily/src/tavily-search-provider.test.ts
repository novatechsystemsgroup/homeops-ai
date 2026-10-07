import { describe, expect, it } from "vitest";
import { createTavilySearchProvider } from "./tavily-search-provider";
import { normalizeSearchResults } from "./normalize";

const RETRIEVED = "2026-10-07T08:00:00.000Z";

function first<T>(items: T[]): T {
  const item = items[0];
  if (!item) throw new Error("expected at least one item");
  return item;
}

describe("Tavily result normalisation", () => {
  it("drops results without a usable url and de-duplicates", () => {
    const sources = normalizeSearchResults(
      [
        { title: "Gas Safe Register", url: "https://www.gassaferegister.co.uk/", content: "Find an engineer" },
        { title: "No url", url: "", content: "should be dropped" },
        { title: "Duplicate", url: "https://www.gassaferegister.co.uk", content: "duplicate host path" },
        { title: "Broken", url: "not-a-url", content: "dropped" }
      ],
      RETRIEVED,
      5
    );
    expect(sources).toHaveLength(1);
    expect(first(sources).url).toBe("https://www.gassaferegister.co.uk/");
  });

  it("respects the limit and truncates long snippets", () => {
    const raw = Array.from({ length: 8 }, (_, index) => ({
      title: `Result ${index}`,
      url: `https://example.com/${index}`,
      content: "x".repeat(900)
    }));
    const sources = normalizeSearchResults(raw, RETRIEVED, 3);
    expect(sources).toHaveLength(3);
    expect(first(sources).snippet.length).toBeLessThanOrEqual(400);
  });
});

describe("TavilySearchProvider", () => {
  it("returns normalised sources through the SearchProvider port", async () => {
    const provider = createTavilySearchProvider({
      apiKey: "test-key",
      searchImpl: async (query, { limit }) => {
        expect(query).toContain("boiler");
        expect(limit).toBe(2);
        return [
          { title: "A", url: "https://example.com/a", content: "alpha" },
          { title: "B", url: "https://example.com/b", content: "beta" }
        ];
      }
    });

    const sources = await provider.search("boiler service Bristol", { limit: 2, location: "Bristol" });
    expect(sources.map((source) => source.url)).toEqual(["https://example.com/a", "https://example.com/b"]);
    expect(first(sources).retrievedAt).toBeTruthy();
  });
});
