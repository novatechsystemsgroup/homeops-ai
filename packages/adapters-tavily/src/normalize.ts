import type { Source } from "@homeops/contracts";
import { SourceSchema } from "@homeops/contracts";

export interface RawSearchResult {
  title?: string | null;
  url?: string | null;
  content?: string | null;
  snippet?: string | null;
  score?: number | null;
}

/**
 * Normalises provider results into the Source contract.
 * Results without a usable URL are dropped: we never cite what we cannot link.
 */
export function normalizeSearchResults(results: RawSearchResult[], retrievedAt: string, limit: number): Source[] {
  const seen = new Set<string>();
  const normalized: Source[] = [];

  for (const result of results) {
    const url = typeof result.url === "string" ? result.url.trim() : "";
    if (!url) continue;
    let parsed;
    try {
      parsed = SourceSchema.safeParse({
        title: (result.title ?? url).toString().trim().slice(0, 200) || url,
        url,
        retrievedAt,
        snippet: (result.content ?? result.snippet ?? "").toString().replace(/\s+/g, " ").trim().slice(0, 400)
      });
    } catch {
      continue;
    }
    if (!parsed.success) continue;

    const key = parsed.data.url.replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(parsed.data);
    if (normalized.length >= limit) break;
  }

  return normalized;
}
