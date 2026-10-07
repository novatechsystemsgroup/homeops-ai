"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentTraceEvent, Household, PlanAction, RepairPlan } from "@homeops/contracts";
import { api, type ApiMetaResponse, type SafetyAssessmentResponse } from "@/lib/api";
import { speak, speechSupported, stopSpeaking } from "@/lib/speech";
import { useVoiceInput } from "@/lib/use-voice-input";
import { PlanCard } from "./PlanCard";
import { TracePanel } from "./TracePanel";

export const SCENARIOS = {
  boiler:
    "The boiler is making a loud humming noise. We have guests arriving on Saturday and I do not want to be without hot water.",
  gas: "There is a smell of gas next to the boiler cupboard and we have guests arriving tonight."
} as const;

export type ScenarioKey = keyof typeof SCENARIOS;

const STAGES = ["Safety triage", "NVIDIA model plans", "Tavily research", "Plan ready"] as const;
const SCENARIO_KEYS = Object.keys(SCENARIOS) as ScenarioKey[];

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

function scenarioFromUrl(): ScenarioKey | null {
  if (typeof window === "undefined") return null;
  const requested = new URLSearchParams(window.location.search).get("scenario");
  return SCENARIO_KEYS.find((key) => key === requested) ?? null;
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
  const [speakReplies, setSpeakReplies] = useState(false);
  const [lastScenario, setLastScenario] = useState<ScenarioKey | null>(null);
  const [autoScenario, setAutoScenario] = useState<ScenarioKey | null>(null);
  // Deterministic triage is shown as soon as it arrives, without waiting for the model.
  const [triage, setTriage] = useState<SafetyAssessmentResponse["assessment"] | null>(null);
  // Resolved in an effect so the server and the first client render agree.
  const [canSpeak, setCanSpeak] = useState(false);
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
    if (speakReplies) return;
    stopSpeaking();
  }, [speakReplies]);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setElapsed((value) => value + 0.1), 100);
    return () => clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    setCanSpeak(speechSupported());
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      const [demoHousehold, apiMeta] = await Promise.all([api.demoHousehold(), api.meta()]);
      setHousehold(demoHousehold);
      setMeta(apiMeta);
      setMessages([
        {
          id: newId(),
          role: "assistant",
          text: "Tell me what is happening at home and I will build an executable plan. Try one of the scenarios below."
        }
      ]);
    } catch (caught) {
      setError(`${describe(caught)} — start the API with "pnpm dev" (expected on ${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787"}).`);
    }
  }, []);

  const submit = useCallback(
    async (description: string, scenario: ScenarioKey | null = null, clarificationAnswers: string[] = []) => {
      if (!household || busy) return;
      setBusy(true);
      setElapsed(0);
      setError(null);
      setNotice(null);
      setMessages((previous) => [...previous, { id: newId(), role: "user", text: description }]);
      setInput("");
      setTriage(null);
      if (scenario) setLastScenario(scenario);

      // Fire the deterministic triage first: it answers in milliseconds and is the
      // first thing the user should see, long before the model finishes planning.
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
    setAutoScenario(scenarioFromUrl());
    void bootstrap();
  }, [bootstrap]);

  // Waiting for the household keeps submit() from running before bootstrap finishes.
  useEffect(() => {
    if (!autoScenario || !household) return;
    const scenario = autoScenario;
    setAutoScenario(null);
    void submit(SCENARIOS[scenario], scenario);
  }, [autoScenario, household, submit]);

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
      } else {
        setNotice(response.message ?? "Confirmation was required and not applied.");
      }
      await refreshTrace(plan.id);
    },
    [plan, refreshTrace]
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
      setNotice("No plan in this session yet — build one first.");
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

  return (
    <div className={variant === "nebius" ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]" : "grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]"}>
      <section className="card flex min-h-[560px] flex-col p-4 sm:p-5">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold">{variant === "alexa" ? "Alexa+ simulator" : "Agent console"}</h1>
            <p className="text-[11px] text-slate-400">
              {meta
                ? `model: ${meta.modelProvider}${meta.model ? ` (${meta.model})` : ""} · research: ${meta.searchProvider}`
                : "connecting…"}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {canSpeak ? (
              <button
                type="button"
                aria-pressed={speakReplies}
                className={`rounded-lg border px-3 py-1.5 ${speakReplies ? "border-sky-400 text-sky-300" : "border-slate-600 hover:border-slate-400"}`}
                onClick={() => setSpeakReplies((value) => !value)}
              >
                {speakReplies ? "🔊 Speaking" : "🔈 Speak replies"}
              </button>
            ) : null}
            <button type="button" className="rounded-lg border border-slate-600 px-3 py-1.5 hover:border-slate-400" onClick={newConversation}>
              New conversation
            </button>
          </div>
        </header>

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
                  onClick={() => lastScenario && void submit(SCENARIOS[lastScenario], lastScenario)}
                >
                  Retry the last request
                </button>
              </div>
            </div>
          ) : null}

          {notice ? <div className="rounded-xl border border-sky-400/40 bg-sky-500/10 p-3 text-sm text-sky-100">{notice}</div> : null}

          {plan?.degraded ? (
            <div className="rounded-xl border border-amber-400/50 bg-amber-500/10 p-3 text-sm text-amber-100" data-testid="degraded-banner">
              The model was unavailable or returned something invalid, so this plan comes from the deterministic safety rules. The demo keeps
              going; the agent trace shows the failed attempts.
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
            <button type="button" className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950" onClick={() => void submit(messages.findLast((message) => message.role === "user")?.text ?? "", lastScenario, answers.filter((answer) => answer.trim() !== ""))} disabled={busy}>
              Send answers
            </button>
          </div>
        ) : null}

        <form
          className="mt-4 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (input.trim().length > 2) void submit(input.trim(), null);
          }}
        >
          <input
            aria-label="Describe what is happening at home"
            className="min-w-[200px] flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
            placeholder="Describe what is happening at home…"
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          <button
            type="button"
            data-testid="voice-button"
            className={`rounded-lg border px-3 py-2 text-sm ${voice.state === "listening" ? "border-rose-400 text-rose-300" : "border-slate-600 hover:border-slate-400"}`}
            onClick={() => (voice.state === "listening" ? voice.stop() : voice.start())}
            title={voice.supported ? "Speak the scenario (browser speech recognition)" : "Voice input is not available in this browser"}
          >
            {voice.state === "listening" ? "🎙 Listening…" : "🎙 Voice"}
          </button>
          <button type="submit" className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-60" disabled={busy} data-testid="send-button">
            {busy ? "Working…" : "Send"}
          </button>
        </form>

        {voice.error ? <p className="mt-2 text-xs text-amber-300">{voice.error}</p> : null}

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <button type="button" className="rounded-lg border border-slate-700 px-3 py-1.5 hover:border-sky-400" onClick={() => void submit(SCENARIOS.boiler, "boiler")} disabled={busy} data-testid="scenario-boiler">
            Boiler before the weekend
          </button>
          <button type="button" className="rounded-lg border border-slate-700 px-3 py-1.5 hover:border-rose-400" onClick={() => void submit(SCENARIOS.gas, "gas")} disabled={busy} data-testid="scenario-gas">
            Gas emergency
          </button>
          <button type="button" className="rounded-lg border border-slate-700 px-3 py-1.5 hover:border-emerald-400" onClick={() => void checkPlanLater()} disabled={busy} data-testid="check-plan">
            Did we fix the boiler?
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
      </section>

      <div className="space-y-6">
        {plan ? (
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-400" data-testid="plan-status-summary">
              <span className="badge bg-slate-600/20 text-slate-200">{openActions} open</span>
              <span className="badge bg-emerald-500/15 text-emerald-300">{doneActions} done</span>
              {plan.sources.length > 0 ? <span className="badge bg-sky-500/15 text-sky-300">{plan.sources.length} sources</span> : null}
              <a
                className="rounded-lg border border-slate-600 px-3 py-1 hover:border-slate-400"
                href={`/plan/${plan.id}`}
                data-testid="open-plan-page"
              >
                Open plan page
              </a>
            </div>
            <PlanCard plan={plan} members={household?.members ?? []} onAssign={onAssign} onStatusChange={onStatusChange} />
          </div>
        ) : (
          <section className="card p-5 text-sm text-slate-400">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">What you will see</h2>
            <ol className="mt-3 space-y-2">
              <li>1. Your sentence becomes a structured intake.</li>
              <li>2. Deterministic rules triage risk — a model can raise urgency, never lower it.</li>
              <li>3. The NVIDIA model on Nebius drafts the plan; Tavily adds current sources.</li>
              <li>4. Every external action waits for your confirmation.</li>
              <li>5. The plan is stored, so a later conversation can resume it.</li>
            </ol>
          </section>
        )}
        {variant === "nebius" ? <TracePanel events={trace} meta={meta} /> : null}
      </div>
    </div>
  );
}
