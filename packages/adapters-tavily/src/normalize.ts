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
/**
 * Deduplication key: tracking parameters, anchors and trailing slashes all point at
 * the same page, so they must not fill the source list with near-identical entries.
 */
function dedupeKey(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, "").toLowerCase()}${parsed.pathname.replace(/\/+$/, "").toLowerCase()}`;
  } catch {
    return url.replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
  }
}

/** Tavily content often starts with "Title: ..."; that noise is not a useful snippet. */
export function cleanSnippet(raw: string): string {
  return raw
    .replace(/^\s*title:\s*/i, "")
    .replace(/\b(?:URL|Source):\s*\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSearchResults(results: RawSearchResult[], retrievedAt: string, limit: number): Source[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const normalized: Source[] = [];

  for (const result of results) {
    const url = typeof result.url === "string" ? result.url.trim() : "";
    if (!url) continue;

    const key = dedupeKey(url);
    if (seenUrls.has(key)) continue;

    const title = (result.title ?? url).toString().replace(/\s+/g, " ").trim().slice(0, 200) || url;
    const titleKey = title.toLowerCase();
    // The same guide is often served under several URLs; keep the first one only.
    if (title.length > 12 && seenTitles.has(titleKey)) continue;

    const parsed = SourceSchema.safeParse({
      title,
      url,
      retrievedAt,
      snippet: cleanSnippet((result.content ?? result.snippet ?? "").toString()).slice(0, 400)
    });
    if (!parsed.success) continue;

    seenUrls.add(key);
    seenTitles.add(titleKey);
    normalized.push(parsed.data);
    if (normalized.length >= limit) break;
  }

  return normalized;
}
