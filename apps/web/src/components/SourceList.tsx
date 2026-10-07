import type { Source } from "@homeops/contracts";

export function SourceList({ sources, researchStatus }: { sources: Source[]; researchStatus: string }) {
  if (researchStatus === "unavailable") {
    return <p className="mt-3 text-xs text-amber-300">Research was unavailable for this plan: no sources are shown rather than guessed.</p>;
  }
  if (sources.length === 0) {
    return <p className="mt-3 text-xs text-slate-400">No runtime research was needed for this plan.</p>;
  }
  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sources</h4>
      <ul className="mt-2 space-y-2">
        {sources.map((source) => (
          <li key={source.url} className="text-sm">
            <a className="text-sky-300 hover:underline" href={source.url} target="_blank" rel="noreferrer">
              {source.title}
            </a>
            {source.snippet ? <p className="text-xs text-slate-400">{source.snippet}</p> : null}
            <p className="text-[11px] text-slate-500">retrieved {new Date(source.retrievedAt).toLocaleString("en-GB")}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
