"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentTraceEvent, Household, PlanAction, RepairPlan } from "@homeops/contracts";
import { api, type ApiMetaResponse } from "@/lib/api";
import { PlanCard } from "./PlanCard";
import { TracePanel } from "./TracePanel";

const BOILER_SCENARIO =
  "The boiler is making a loud humming noise. We have guests arriving on Saturday and I do not want to be without hot water.";
const EMERGENCY_SCENARIO = "There is a smell of gas next to the boiler cupboard.";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  start(): void;
}

function newId(): string {
  return Math.random().toString(36).slice(2);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function HomeOpsConsole({ variant }: { variant: "alexa" | "nebius" }) {
  const [household, setHousehold] = useState<Household | null>(null);
  const [meta, setMeta] = useState<ApiMetaResponse | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [plan, setPlan] = useState<RepairPlan | null>(null);
  const [trace, setTrace] = useState<AgentTraceEvent[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [lastDescription, setLastDescription] = useState<string>("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const bootstrapped = useRef(false);

  const bootstrap = useCallback(async () => {
    try {
      const [demoHousehold, apiMeta] = await Promise.all([api.demoHousehold(), api.meta()]);
      setHousehold(demoHousehold);
      setMeta(apiMeta);
      setMessages([
        {
          id: newId(),
          role: "assistant",
          text: "Hi — describe what is happening at home and I will build an executable plan. Try the boiler scenario below, or ask for the gas example."
        }
      ]);
    } catch (caught) {
      setError(`${describe(caught)} — is the API running on ${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787"}?`);
    }
  }, []);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void bootstrap();
  }, [bootstrap]);

  const submit = useCallback(
    async (description: string, clarificationAnswers: string[] = []) => {
      if (!household || busy) return;
      setBusy(true);
      setError(null);
      setNotice(null);
      setMessages((previous) => [...previous, { id: newId(), role: "user", text: description }]);
      setInput("");

      try {
        const response = await api.createPlan({ householdId: household.id, description, clarificationAnswers });
        setPlan(response.plan);
        setTrace(response.trace);
        setLastDescription(description);

        if (response.clarificationRequired) {
          setQuestions(response.plan.clarifyingQuestions);
          setAnswers(new Array(response.plan.clarifyingQuestions.length).fill(""));
          setMessages((previous) => [
            ...previous,
            {
              id: newId(),
              role: "assistant",
              text: `Two quick questions before I plan: ${response.plan.clarifyingQuestions.join(" ")}`
            }
          ]);
        } else {
          setQuestions([]);
          setAnswers([]);
          setMessages((previous) => [
            ...previous,
            {
              id: newId(),
              role: "assistant",
              text: `${response.plan.issueSummary} Urgency: ${response.plan.urgency.replace("_", " ")}. ${response.plan.actions.length} actions${response.plan.sources.length ? `, ${response.plan.sources.length} sources` : ""}.`
            }
          ]);
        }
      } catch (caught) {
        setError(describe(caught));
      } finally {
        setBusy(false);
      }
    },
    [busy, household]
  );

  const onAssign = useCallback(
    async (actionId: string, ownerMemberId: string) => {
      if (!plan) return;
      setNotice(null);
      const response = await api.assign(plan.id, actionId, ownerMemberId);
      if (response.status === "ok" && response.plan) {
        setPlan(response.plan);
        setNotice("Assignment saved locally. No message was sent and nobody was called.");
      } else {
        setNotice(response.message ?? "Confirmation was required and not applied.");
      }
      await refreshTrace(plan.id);
    },
    [plan]
  );

  const onStatusChange = useCallback(
    async (actionId: string, status: PlanAction["status"]) => {
      if (!plan) return;
      const response = await api.updateStatus(plan.id, actionId, status);
      if (response.status === "ok" && response.plan) setPlan(response.plan);
      else setNotice(response.message ?? "Confirmation was required and not applied.");
      await refreshTrace(plan.id);
    },
    [plan]
  );

  const refreshTrace = useCallback(async (planId: string) => {
    try {
      const envelope = await api.plan(planId);
      setPlan(envelope.plan);
      setTrace(envelope.trace);
    } catch {
      // the trace panel simply keeps the previous events
    }
  }, []);

  const checkPlanLater = useCallback(async () => {
    if (!plan) {
      setNotice("No plan yet in this browser session. Build one first.");
      return;
    }
    await refreshTrace(plan.id);
    const open = plan.actions.filter((action) => action.status !== "done");
    setMessages((previous) => [
      ...previous,
      {
        id: newId(),
        role: "assistant",
        text: open.length
          ? `Here is where the plan stands: still open — ${open.map((action) => action.title).join("; ")}.`
          : "Every action in the plan is marked done."
      }
    ]);
  }, [plan, refreshTrace]);

  const startVoice = useCallback(() => {
    const recognition = (
      window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }
    ).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;

    if (!recognition) {
      setNotice("Voice input is not available in this browser — type the scenario instead.");
      return;
    }
    const instance = new recognition();
    instance.lang = "en-GB";
    instance.continuous = false;
    instance.interimResults = false;
    instance.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (transcript) setInput(transcript);
    };
    instance.start();
  }, []);

  const submitAnswers = useCallback(() => {
    void submit(lastDescription, answers.map((answer) => answer.trim()).filter(Boolean));
  }, [answers, lastDescription, submit]);

  return (
    <div className={`grid gap-6 ${variant === "nebius" ? "lg:grid-cols-[minmax(0,1fr)_380px]" : "lg:grid-cols-[minmax(0,1fr)_320px]"}`}>
      <section className="card flex min-h-[520px] flex-col p-5">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">{variant === "alexa" ? "Alexa+ simulator" : "Agent console"}</h1>
          <span className="text-[11px] text-slate-400">
            {meta ? `model: ${meta.modelProvider}${meta.model ? ` (${meta.model})` : ""} · search: ${meta.searchProvider}` : "connecting…"}
          </span>
        </header>

        <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${message.role === "user" ? "ml-auto bg-sky-500/20 text-sky-50" : "bg-slate-800/70 text-slate-200"}`}
            >
              {message.text}
            </div>
          ))}
          {busy ? <div className="max-w-[85%] rounded-2xl bg-slate-800/70 px-4 py-2.5 text-sm text-slate-400">Planning…</div> : null}
          {error ? <div className="rounded-xl border border-rose-400/50 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div> : null}
          {notice ? <div className="rounded-xl border border-sky-400/40 bg-sky-500/10 p-3 text-sm text-sky-100">{notice}</div> : null}
        </div>

        {questions.length > 0 ? (
          <div className="mt-4 space-y-2 rounded-xl border border-sky-400/40 bg-sky-500/5 p-3">
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
            <button type="button" className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950" onClick={submitAnswers} disabled={busy}>
              Send answers
            </button>
          </div>
        ) : null}

        <form
          className="mt-4 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (input.trim().length > 2) void submit(input.trim());
          }}
        >
          <input
            className="min-w-[200px] flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
            placeholder="Describe what is happening at home…"
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          <button type="button" className="rounded-lg border border-slate-600 px-3 py-2 text-sm" onClick={startVoice} title="Voice input (browser support required)">
            🎙 Voice
          </button>
          <button type="submit" className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950" disabled={busy}>
            {busy ? "Working…" : "Send"}
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <button type="button" className="rounded-lg border border-slate-700 px-3 py-1.5 hover:border-sky-400" onClick={() => void submit(BOILER_SCENARIO)} disabled={busy}>
            Boiler scenario
          </button>
          <button type="button" className="rounded-lg border border-slate-700 px-3 py-1.5 hover:border-rose-400" onClick={() => void submit(EMERGENCY_SCENARIO)} disabled={busy}>
            Gas emergency
          </button>
          <button type="button" className="rounded-lg border border-slate-700 px-3 py-1.5 hover:border-emerald-400" onClick={() => void checkPlanLater()} disabled={busy}>
            Did we fix the boiler?
          </button>
          {household ? (
            <button
              type="button"
              className="rounded-lg border border-slate-700 px-3 py-1.5 hover:border-rose-400"
              onClick={() => void api.deleteDemoData(household.id).then(() => setNotice("Demo household data deleted."))}
            >
              Delete demo data
            </button>
          ) : null}
        </div>
      </section>

      <div className="space-y-6">
        {plan ? <PlanCard plan={plan} members={household?.members ?? []} onAssign={onAssign} onStatusChange={onStatusChange} /> : null}
        {variant === "nebius" ? <TracePanel events={trace} meta={meta} /> : null}
      </div>
    </div>
  );
}
