"use client";

import { SCENARIOS } from "@/lib/scenarios";

export function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <section className="card mb-4 p-5 text-sm text-slate-200" data-testid="help-panel">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-base font-semibold">How to use this demo</h2>
        <button type="button" className="rounded-lg border border-slate-600 px-3 py-1 text-xs hover:border-slate-400" onClick={onClose}>
          Close
        </button>
      </div>

      <ol className="mt-3 grid gap-2 md:grid-cols-2">
        <li className="rounded-xl border border-slate-700/70 p-3">
          <p className="font-medium text-slate-100">1. Say or type the problem</p>
          <p className="mt-1 text-slate-400">
            Anything about your home: heating, water, electrics, appliances, doors. Press the microphone button and speak, or type in the box.
          </p>
        </li>
        <li className="rounded-xl border border-slate-700/70 p-3">
          <p className="font-medium text-slate-100">2. Answer at most two questions</p>
          <p className="mt-1 text-slate-400">
            The agent only asks when the answer changes the plan — for example whether there is any smell of gas.
          </p>
        </li>
        <li className="rounded-xl border border-slate-700/70 p-3">
          <p className="font-medium text-slate-100">3. Read the plan and confirm</p>
          <p className="mt-1 text-slate-400">
            The card on the right lists the actions, the owner and the sources. Nothing outside this app happens until you confirm.
          </p>
        </li>
        <li className="rounded-xl border border-slate-700/70 p-3">
          <p className="font-medium text-slate-100">4. Come back later</p>
          <p className="mt-1 text-slate-400">
            Press <span className="text-slate-200">Did we fix it?</span> or open the plan page: the plan is stored, so a new conversation
            continues where you stopped.
          </p>
        </li>
      </ol>

      <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-100">
        <p className="font-semibold uppercase tracking-wide">Voice troubleshooting</p>
        <ul className="mt-1 space-y-1">
          <li>• Speech recognition works in Chrome, Edge and Safari. Firefox does not implement it — type instead.</li>
          <li>• The browser asks for microphone permission once: choose Allow. If you blocked it, unlock it in the address bar.</li>
          <li>• Recognition runs in the browser vendor's cloud, so it needs an internet connection.</li>
          <li>• Replies are spoken by default; use the speaker button in the header to turn them off.</li>
        </ul>
      </div>

      <div className="mt-4">
        <p className="text-xs uppercase tracking-wide text-slate-400">Examples you can try (or ask anything else)</p>
        <ul className="mt-2 flex flex-wrap gap-2 text-xs">
          {SCENARIOS.map((scenario) => (
            <li key={scenario.id} className="rounded-lg border border-slate-700 px-2 py-1 text-slate-300">
              {scenario.icon} {scenario.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
