export function SafetyBanner({ urgency, guidance }: { urgency: string; guidance: string[] }) {
  if (guidance.length === 0) return null;
  const emergency = urgency === "emergency";
  return (
    <section
      role="alert"
      className={`mt-3 rounded-xl border p-4 text-sm ${emergency ? "border-rose-400/60 bg-rose-500/15 text-rose-100" : "border-amber-400/50 bg-amber-500/10 text-amber-100"}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide">{emergency ? "Emergency guidance" : "Safety guidance"}</p>
      <ul className="mt-2 space-y-1.5">
        {guidance.map((line) => (
          <li key={line}>• {line}</li>
        ))}
      </ul>
    </section>
  );
}
