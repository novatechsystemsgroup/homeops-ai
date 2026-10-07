"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentTraceEvent, Household, PlanAction, RepairPlan } from "@homeops/contracts";
import { api, type ApiMetaResponse, type SafetyAssessmentResponse } from "@/lib/api";
import { SCENARIOS, scenarioById, type Scenario } from "@/lib/scenarios";
import { speak, speechSupported, stopSpeaking } from "@/lib/speech";
import { useVoiceInput } from "@/lib/use-voice-input";
import { HelpPanel } from "./HelpPanel";
import { PlanCard } from "./PlanCard";
import { TracePanel } from "./TracePanel";

const SPEAK_PREFERENCE_KEY = "homeops.speakReplies";
const STAGES = ["Deterministic safety triage", "NVIDIA model plans", "Tavily research", "Plan stored"];

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

function newId(): string {
  return Math.random().toString(36).slice(2);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Deep links: /alexa?scenario=kitchen-leak or /alexa?ask=<url encoded text>. */
function requestFromUrl(): { scenario?: Scenario; text?: string } {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const scenario = scenarioById(params.get("scenario"));
  if (scenario) return { scenario };
  const ask = params.get("ask");
  if (ask && ask.trim().length > 2) return { text: ask.trim() };
  return {};
}

export function HomeOpsConsole({ variant }: { variant: "alexa" | "nebius" }) {
  const [household, setHousehold] = useState<Household | null>(null);
  const [meta, setMeta] = useState<ApiMetaResponse | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [plan, setPlan] = useState<RepairPlan | null>(null);
  const [trace, setTrace] = useState<AgentTraceEvent[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [triage, setTriage] = useState<SafetyAssessmentResponse["assessment"] | null>(null);
  const [speakReplies, setSpeakReplies] = useState(true);
  const [canSpeak, setCanSpeak] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [pendingScenario, setPendingScenario] = useState<Scenario | null>(null);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<{ text: string; scenario: Scenario | null } | null>(null);
  const bootstrapped = useRef(false);

  const onTranscript = useCallback((text: string) => setInput(text), []);
  const voice = useVoiceInput(onTranscript);

  const say = useCallback(
    (text: string) => {
      setMessages((previous) => [...previous, { id: newId(), role: "assistant", text }]);
      if (speakReplies) speak(text);
    },
    [speakReplies]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCanSpeak(speechSupported());
    const stored = window.localStorage.getItem(SPEAK_PREFERENCE_KEY);
    if (stored === "off") setSpeakReplies(false);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(SPEAK_PREFERENCE_KEY, speakReplies ? "on" : "off");
    if (!speakReplies) stopSpeaking();
  }, [speakReplies]);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setElapsed((value) => value + 0.1), 100);
    return () => clearInterval(timer);
  }, [busy]);

  const bootstrap = useCallback(async () => {
    try {
      const [demoHousehold, apiMeta] = await Promise.all([api.demoHousehold(), api.meta()]);
      setHousehold(demoHousehold);
      setMeta(apiMeta);
      setMessages([
        {
          id: newId(),
          role: "assistant",
          text: "Tell me what is happening at home — heating, water, electrics, appliances, anything. I will ask at most two questions, then build a plan you can act on."
        }
      ]);
    } catch (caught) {
      setError(`${describe(caught)} — the demo API is not reachable right now.`);
    }
  }, []);

  const submit = useCallback(
    async (description: string, scenario: Scenario | null = null, clarificationAnswers: string[] = []) => {
      if (!household || busy) return;
      setBusy(true);
      setElapsed(0);
      setError(null);
      setNotice(null);
      setMessages((previous) => [...previous, { id: newId(), role: "user", text: description }]);
      setInput("");
      setTriage(null);
      setLastRequest({ text: description, scenario });

      // The deterministic triage answers in milliseconds: show it before the model finishes.
      void api
        .safetyGuidance(description)
        .then((response) => setTriage(response.assessment))
        .catch(() => undefined);

      try {
        const response = await api.createPlan({ householdId: household.id, description, clarificationAnswers });
        setPlan(response.plan);
        setTrace(response.trace);

        if (response.clarificationRequired) {
          setQuestions(response.plan.clarifyingQuestions);
          setAnswers(new Array(response.plan.clarifyingQuestions.length).fill(""));
          say(`Two quick questions before I plan: ${response.plan.clarifyingQuestions.join(" ")}`);
        } else {
          setQuestions([]);
          setAnswers([]);
          const emergency = response.plan.urgency === "emergency";
          say(
            emergency
              ? `This could be an emergency. ${response.plan.safetyGuidance[0] ?? "Follow the safety guidance below."}`
              : `${response.plan.issueSummary} Urgency: ${response.plan.urgency.replace("_", " ")}. ${response.plan.actions.length} actions${response.plan.sources.length ? `, ${response.plan.sources.length} sources` : ""}.`
          );
        }
      } catch (caught) {
        setError(describe(caught));
      } finally {
        setBusy(false);
      }
    },
    [busy, household, say]
  );

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    const request = requestFromUrl();
    setPendingScenario(request.scenario ?? null);
    setPendingText(request.text ?? null);
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!household) return;
    if (pendingScenario) {
      const scenario = pendingScenario;
      setPendingScenario(null);
      void submit(scenario.text, scenario);
      return;
    }
    if (pendingText) {
      const text = pendingText;
      setPendingText(null);
      void submit(text, null);
    }
  }, [household, pendingScenario, pendingText, submit]);

  const refreshTrace = useCallback(async (planId: string) => {
    try {
      const envelope = await api.plan(planId);
      setPlan(envelope.plan);
      setTrace(envelope.trace);
    } catch {
      // keep the events already on screen
    }
  }, []);

  const onAssign = useCallback(
    async (actionId: string, ownerMemberId: string) => {
      if (!plan) return;
      setNotice(null);
      const response = await api.assign(plan.id, actionId, ownerMemberId);
      if (response.status === "ok" && response.plan) {
        setPlan(response.plan);
        setNotice("Assignment saved locally. Nobody was called and no message was sent.");
        if (speakReplies) speak("Assignment saved. Nothing was sent outside this app.");
      } else {
        setNotice(response.message ?? "Confirmation was required and not applied.");
      }
      await refreshTrace(plan.id);
    },
    [plan, refreshTrace, speakReplies]
  );

  const onStatusChange = useCallback(
    async (actionId: string, status: PlanAction["status"]) => {
      if (!plan) return;
      const response = await api.updateStatus(plan.id, actionId, status);
      if (response.status === "ok" && response.plan) setPlan(response.plan);
      else setNotice(response.message ?? "Confirmation was required and not applied.");
      await refreshTrace(plan.id);
    },
    [plan, refreshTrace]
  );

  const checkPlanLater = useCallback(async () => {
    if (!plan) {
      setNotice("No plan in this session yet — describe a problem first.");
      return;
    }
    await refreshTrace(plan.id);
    const open = plan.actions.filter((action) => action.status !== "done");
    say(
      open.length
        ? `Here is where the plan stands: still open — ${open.map((action) => action.title).join("; ")}.`
        : "Every action in the plan is marked done."
    );
  }, [plan, refreshTrace, say]);

  const newConversation = useCallback(() => {
    stopSpeaking();
    setMessages([{ id: newId(), role: "assistant", text: "New conversation. The plan is still stored — ask me what is still open." }]);
    setQuestions([]);
    setAnswers([]);
    setError(null);
    setNotice(null);
  }, []);

  const openActions = plan ? plan.actions.filter((action) => action.status !== "done").length : 0;
  const doneActions = plan ? plan.actions.length - openActions : 0;
  const voiceHelp = voice.error ?? (voice.status === "unsupported" ? "This browser cannot do speech recognition. Use Chrome, Edge or Safari, or type." : null);

  return (
    <div className={variant === "nebius" ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]" : "grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]"}>
      <section className="card flex min-h-[600px] flex-col p-4 sm:p-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">{variant === "alexa" ? "Alexa+ simulator" : "Agent console"}</h1>
            <p className="mt-1 max-w-xl text-xs text-slate-400">
              Describe any household problem by voice or text. The agent triages safety, plans, researches and asks for your confirmation before
              anything happens.
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {meta ? `model: ${meta.modelProvider}${meta.model ? ` (${meta.model})` : ""} · research: ${meta.searchProvider}` : "connecting…"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              data-testid="speak-toggle"
              aria-pressed={speakReplies}
              className={`rounded-lg border px-3 py-1.5 ${speakReplies ? "border-sky-400 text-sky-300" : "border-slate-600 hover:border-slate-400"}`}
              onClick={() => setSpeakReplies((value) => !value)}
              disabled={!canSpeak}
            >
              {speakReplies ? "🔊 Voice replies on" : "🔇 Voice replies off"}
            </button>
            <button
              type="button"
              data-testid="help-toggle"
              className="rounded-lg border border-slate-600 px-3 py-1.5 hover:border-slate-400"
              onClick={() => setHelpOpen((value) => !value)}
            >
              ? How it works
            </button>
            <button type="button" className="rounded-lg border border-slate-600 px-3 py-1.5 hover:border-slate-400" onClick={newConversation}>
              New conversation
            </button>
          </div>
        </header>

        {helpOpen ? <div className="mt-4"><HelpPanel onClose={() => setHelpOpen(false)} /></div> : null}

        <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1" role="log" aria-live="polite" aria-label="Conversation">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm ${message.role === "user" ? "ml-auto bg-sky-500/20 text-sky-50" : "bg-slate-800/70 text-slate-200"}`}
            >
              {message.text}
            </div>
          ))}

          {triage ? (
            <div
              data-testid="triage-banner"
              className={`rounded-xl border p-3 text-sm ${
                triage.urgency === "emergency"
                  ? "border-rose-400/60 bg-rose-500/15 text-rose-100"
                  : "border-slate-600 bg-slate-800/60 text-slate-200"
              }`}
            >
              <p className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide">
                <span>Safety triage</span>
                <span className="badge bg-slate-950/40 text-slate-100" data-testid="triage-urgency">
                  {triage.urgency.replace("_", " ")}
                </span>
                {triage.flags.length > 0 ? <span className="text-slate-300">flags: {triage.flags.join(", ")}</span> : null}
              </p>
              {triage.mandatoryGuidance.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs">
                  {triage.mandatoryGuidance.map((line) => (
                    <li key={line}>• {line}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-slate-400">No emergency signs detected in what you described.</p>
              )}
            </div>
          ) : null}

          {busy ? (
            <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3" data-testid="planning-progress">
              <p className="text-xs text-slate-300">
                Working through the pipeline… <span className="tabular-nums text-slate-400">{elapsed.toFixed(1)}s</span>
              </p>
              <ul className="mt-2 grid gap-1 text-[11px] text-slate-400 sm:grid-cols-2">
                {STAGES.map((stage) => (
                  <li key={stage} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" aria-hidden />
                    {stage}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-rose-400/50 bg-rose-500/10 p-3 text-sm text-rose-100">
              <p>{error}</p>
              <div className="mt-2 flex gap-2">
                <button type="button" className="rounded-lg border border-rose-300/60 px-3 py-1.5 text-xs hover:border-rose-200" onClick={() => void bootstrap()}>
                  Retry connection
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-rose-300/60 px-3 py-1.5 text-xs hover:border-rose-200"
                  disabled={!lastRequest}
                  onClick={() => lastRequest && void submit(lastRequest.text, lastRequest.scenario)}
                >
                  Retry the last request
                </button>
              </div>
            </div>
          ) : null}

          {notice ? <div className="rounded-xl border border-sky-400/40 bg-sky-500/10 p-3 text-sm text-sky-100">{notice}</div> : null}

          {plan?.degraded ? (
            <div className="rounded-xl border border-amber-400/50 bg-amber-500/10 p-3 text-sm text-amber-100" data-testid="degraded-banner">
              The model was unavailable or returned something invalid, so this plan comes from the deterministic safety rules. The demo keeps going;
              the agent trace shows the failed attempts.
            </div>
          ) : null}
        </div>

        {questions.length > 0 ? (
          <div className="mt-4 space-y-2 rounded-xl border border-sky-400/40 bg-sky-500/5 p-3" data-testid="clarification-form">
            {questions.map((question, index) => (
              <label key={question} className="block text-sm">
                <span className="text-slate-300">{question}</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
                  value={answers[index] ?? ""}
                  onChange={(event) => {
                    const next = [...answers];
                    next[index] = event.target.value;
                    setAnswers(next);
                  }}
                />
              </label>
            ))}
            <button
              type="button"
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950"
              onClick={() => void submit(lastRequest?.text ?? "", lastRequest?.scenario ?? null, answers.filter((answer) => answer.trim() !== ""))}
              disabled={busy}
            >
              Send answers
            </button>
          </div>
        ) : null}

        <form
          className="mt-4 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (input.trim().length > 2) void submit(input.trim(), null);
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="voice-button"
              className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${
                voice.listening ? "bg-rose-500 text-slate-950" : "bg-sky-600 text-white hover:bg-sky-500"
              }`}
              onClick={() => (voice.listening ? voice.stop() : voice.start())}
              title="Speak your question (Chrome, Edge, Safari)"
            >
              <span aria-hidden>{voice.listening ? "◉" : "🎙"}</span>
              {voice.listening ? "Listening… press to stop" : "Speak"}
            </button>
            <input
              aria-label="Describe what is happening at home"
              className="min-w-[220px] flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-3 text-sm"
              placeholder="…or type here: e.g. water is dripping under the kitchen sink"
              value={voice.interim ? `${input}` : input}
              onChange={(event) => setInput(event.target.value)}
            />
            <button type="submit" className="rounded-lg bg-sky-500 px-5 py-3 text-sm font-medium text-slate-950 disabled:opacity-60" disabled={busy} data-testid="send-button">
              {busy ? "Working…" : "Send"}
            </button>
          </div>

          {voice.listening && voice.interim ? (
            <p className="text-xs text-rose-200" data-testid="voice-interim">
              hearing: “{voice.interim}”
            </p>
          ) : null}
          {voiceHelp ? <p className="text-xs text-amber-300" data-testid="voice-help">{voiceHelp}</p> : null}
        </form>

        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Try one of these, or ask anything else</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {SCENARIOS.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                data-testid={`scenario-${scenario.id}`}
                className={`rounded-lg border px-3 py-1.5 ${
                  scenario.emergency ? "border-rose-400/50 hover:border-rose-300" : "border-slate-700 hover:border-sky-400"
                }`}
                onClick={() => void submit(scenario.text, scenario)}
                disabled={busy}
                title={scenario.text}
              >
                {scenario.icon} {scenario.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <button type="button" className="rounded-lg border border-slate-700 px-3 py-1.5 hover:border-emerald-400" onClick={() => void checkPlanLater()} disabled={busy} data-testid="check-plan">
              Did we fix it?
            </button>
            {household ? (
              <button
                type="button"
                className="rounded-lg border border-slate-700 px-3 py-1.5 hover:border-rose-400"
                onClick={() =>
                  void api.deleteDemoData(household.id).then(() => {
                    setPlan(null);
                    setTrace([]);
                    setNotice("Demo household data deleted: plans, actions and trace events are gone.");
                  })
                }
              >
                Delete demo data
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="space-y-6">
        {plan ? (
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-400" data-testid="plan-status-summary">
              <span className="badge bg-slate-600/20 text-slate-200">{openActions} open</span>
              <span className="badge bg-emerald-500/15 text-emerald-300">{doneActions} done</span>
              {plan.sources.length > 0 ? <span className="badge bg-sky-500/15 text-sky-300">{plan.sources.length} sources</span> : null}
              <a className="rounded-lg border border-slate-600 px-3 py-1 hover:border-slate-400" href={`/plan/${plan.id}`} data-testid="open-plan-page">
                Open plan page
              </a>
            </div>
            <PlanCard plan={plan} members={household?.members ?? []} onAssign={onAssign} onStatusChange={onStatusChange} />
          </div>
        ) : (
          <section className="card p-5 text-sm text-slate-400">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">What will appear here</h2>
            <ol className="mt-3 space-y-2">
              <li>1. The plan card: urgency, actions with an owner and a deadline, and the sources used.</li>
              <li>2. A confirmation block for every action that would contact someone outside your home.</li>
              <li>3. The agent trace ({variant === "nebius" ? "visible on this page" : "in the Agent trace tab"}): each step, its status and its duration.</li>
            </ol>
          </section>
        )}
        {variant === "nebius" ? <TracePanel events={trace} meta={meta} /> : null}
      </div>
    </div>
  );
}
