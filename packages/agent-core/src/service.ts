import {
  CreatePlanRequestSchema,
  PlanDraftSchema,
  URGENCY_RANK,
  type AgentTraceEvent,
  type Classification,
  type CreatePlanRequest,
  type CreatePlanResponse,
  type Household,
  type HouseholdMember,
  type IssueIntake,
  type IssueType,
  type PlanAction,
  type PlanDraft,
  type PlanEnvelope,
  type RepairPlan,
  type ResearchStatus,
  type SafetyAssessment,
  type Source
} from "@homeops/contracts";
import { DomainError } from "./errors";
import { buildFallbackPlanDraft } from "./fallback";
import { assessSafety } from "./safety/rules";
import type {
  Clock,
  HouseholdRepository,
  IdGenerator,
  ModelProvider,
  NewTraceEventInput,
  PlanModelInput,
  PlanRepository,
  SearchProvider,
  TraceSink
} from "./ports";

export interface ServiceConfig {
  searchEnabled: boolean;
  maxClarifyingQuestions: number;
  modelTimeoutMs: number;
  searchTimeoutMs: number;
  fallbackHouseholdId: string | null;
  searchResultLimit: number;
}

export interface ServiceDeps {
  model: ModelProvider;
  search: SearchProvider;
  plans: PlanRepository;
  households: HouseholdRepository;
  trace: TraceSink;
  clock: Clock;
  ids: IdGenerator;
  config: ServiceConfig;
}

/** Product contract: a household plan stays readable and actionable. */
const MAX_PLAN_ACTIONS = 5;

export type ActionMutationResult =
  | { kind: "ok"; plan: RepairPlan }
  | { kind: "confirmation_required"; message: string; proposedChanges: string[] }
  | { kind: "not_found"; message: string };

export interface AssignActionInput {
  planId: string;
  actionId: string;
  ownerMemberId: string;
  confirm: boolean;
}

export interface UpdateActionStatusInput {
  planId: string;
  actionId: string;
  status: "open" | "assigned" | "done";
  confirm: boolean;
}

export class HomeOpsService {
  private readonly deps: ServiceDeps;

  constructor(deps: ServiceDeps) {
    this.deps = deps;
  }

  async createPlan(rawRequest: unknown): Promise<CreatePlanResponse> {
    const request: CreatePlanRequest = CreatePlanRequestSchema.parse(rawRequest);
    const trace: AgentTraceEvent[] = [];
    const emit = async (event: NewTraceEventInput): Promise<AgentTraceEvent> => {
      const stored = await this.deps.trace.emit(event);
      trace.push(stored);
      return stored;
    };

    const householdId = request.householdId ?? this.deps.config.fallbackHouseholdId;
    if (!householdId) {
      throw new DomainError("household_required", 400, "A householdId is required for this demo.");
    }
    const household = await this.deps.households.getHousehold(householdId);
    if (!household) {
      throw new DomainError("household_not_found", 404, `Household ${householdId} was not found.`);
    }

    const intake: IssueIntake = {
      householdId,
      description: request.description,
      deadline: request.deadline ?? null,
      occupancyNotes: request.occupancyNotes ?? null,
      budgetBand: request.budgetBand ?? "unknown",
      clarificationAnswers: request.clarificationAnswers ?? []
    };

    const planId = this.deps.ids.uuid();
    const startedAt = Date.now();

    await emit({
      planId,
      type: "intake.received",
      status: "ok",
      summary: `Intake received for ${household.name} (${intake.description.length} characters).`
    });

    const safety = assessSafety(intake);
    await emit({
      planId,
      type: "safety.evaluated",
      status: safety.callEmergencyServices ? "degraded" : "ok",
      summary: `Deterministic triage: urgency=${safety.urgency}, flags=${safety.flags.join(",") || "none"}, rules=${safety.ruleIds.join(",") || "none"}.`
    });

    const modelInput: PlanModelInput = { intake, household, safety, today: this.deps.clock.now().toISOString(), repairHint: null };

    // 1. Emergencies never wait for a model.
    if (safety.urgency === "emergency") {
      await emit({
        planId,
        type: "model.plan.skipped",
        status: "ok",
        summary: "Emergency triage: plan built from deterministic rules, model not consulted for urgency."
      });
      const plan = this.assemblePlan({
        planId,
        intake,
        household,
        safety,
        urgency: safety.urgency,
        draft: buildFallbackPlanDraft(modelInput),
        sources: [],
        researchStatus: "skipped",
        degraded: false
      });
      await this.deps.plans.savePlan(plan);
      await emit({ planId, type: "plan.persisted", status: "ok", summary: `Plan stored with ${plan.actions.length} actions.` });
      await emit({
        planId,
        type: "response.returned",
        status: "ok",
        summary: "Emergency guidance returned to the user.",
        durationMs: Date.now() - startedAt
      });
      return { plan, trace, clarificationRequired: false };
    }

    // 2. One controlled clarification round.
    let issueType: IssueType | null = null;
    if (intake.clarificationAnswers.length === 0) {
      const classification = await this.tryClassify(modelInput, planId, emit);
      if (classification) {
        issueType = classification.issueType;
        const questions = classification.questions.slice(0, this.deps.config.maxClarifyingQuestions);
        if (classification.needsClarification && questions.length > 0) {
          await emit({
            planId,
            type: "clarification.requested",
            status: "ok",
            provider: this.deps.model.name,
            model: this.deps.model.fastModel,
            summary: `${questions.length} clarifying question(s) asked before planning.`
          });
          return { plan: this.assembleClarificationPlan({ planId, intake, household, safety, questions }), trace, clarificationRequired: true };
        }
      }
    }

    // 3. Structured planning with one repair retry, then a deterministic fallback.
    const draft = await this.planWithRetry(modelInput, planId, emit);

    // 4. Deterministic safety is a floor, never a ceiling set by the model.
    let urgency = draft.urgency;
    if (URGENCY_RANK[draft.urgency] < URGENCY_RANK[safety.urgency]) {
      urgency = safety.urgency;
      await emit({
        planId,
        type: "safety.override.applied",
        status: "ok",
        summary: `Model urgency ${draft.urgency} raised to ${safety.urgency} by deterministic rules.`
      });
    }

    // 5. Runtime research, only when it can help and never for emergencies.
    const sources: Source[] = [];
    let researchStatus: ResearchStatus = "skipped";
    if (this.deps.config.searchEnabled) {
      const query = buildSearchQuery(intake, household, issueType);
      await emit({
        planId,
        type: "search.requested",
        status: "ok",
        provider: this.deps.search.name,
        summary: `Researching options: ${query}`
      });
      const searchStarted = Date.now();
      try {
        const results = await withTimeout(
          this.deps.search.search(query, { limit: this.deps.config.searchResultLimit, location: household.city }),
          this.deps.config.searchTimeoutMs,
          "search"
        );
        sources.push(...results);
        researchStatus = results.length > 0 ? "ok" : "unavailable";
        await emit({
          planId,
          type: "search.completed",
          status: researchStatus === "ok" ? "ok" : "degraded",
          provider: this.deps.search.name,
          durationMs: Date.now() - searchStarted,
          summary: researchStatus === "ok" ? `${results.length} source(s) attached.` : "Research returned no usable sources."
        });
      } catch (error) {
        researchStatus = "unavailable";
        await emit({
          planId,
          type: "search.completed",
          status: "error",
          provider: this.deps.search.name,
          durationMs: Date.now() - searchStarted,
          summary: `Research failed: ${describe(error)}`
        });
      }
    } else {
      await emit({ planId, type: "search.skipped", status: "ok", summary: "Runtime research disabled by configuration." });
    }

    const plan = this.assemblePlan({
      planId,
      intake,
      household,
      safety,
      urgency,
      draft,
      sources,
      researchStatus,
      degraded: draft.degraded
    });
    await this.deps.plans.savePlan(plan);
    await emit({ planId, type: "plan.persisted", status: "ok", summary: `Plan stored with ${plan.actions.length} actions.` });

    if (plan.actions.some((candidate) => candidate.requiresConfirmation)) {
      await emit({
        planId,
        type: "confirmation.required",
        status: "ok",
        summary: `${plan.actions.filter((candidate) => candidate.requiresConfirmation).length} action(s) need explicit confirmation.`
      });
    }

    await emit({
      planId,
      type: "response.returned",
      status: degradedAwareStatus(plan),
      durationMs: Date.now() - startedAt,
      summary: `Plan returned with urgency=${plan.urgency} and researchStatus=${plan.researchStatus}.`
    });

    return { plan, trace, clarificationRequired: false };
  }

  async getPlanEnvelope(planId: string): Promise<PlanEnvelope | null> {
    const plan = await this.deps.plans.getPlan(planId);
    if (!plan) return null;
    const trace = await this.deps.trace.listByPlan(planId);
    return { plan, trace, openActions: plan.actions.filter((action) => action.status !== "done") };
  }

  async listOpenPlans(householdId: string): Promise<RepairPlan[]> {
    return this.deps.plans.listOpenPlans(householdId);
  }

  getSafetyGuidance(description: string): SafetyAssessment {
    return assessSafety({ description, occupancyNotes: null });
  }

  async searchOptions(query: string, location: string | null, limit: number): Promise<{ sources: Source[]; researchStatus: ResearchStatus }> {
    try {
      const sources = await withTimeout(
        this.deps.search.search(query, { limit, location }),
        this.deps.config.searchTimeoutMs,
        "search"
      );
      return { sources, researchStatus: sources.length > 0 ? "ok" : "unavailable" };
    } catch {
      return { sources: [], researchStatus: "unavailable" };
    }
  }

  async assignAction(input: AssignActionInput): Promise<ActionMutationResult> {
    const plan = await this.deps.plans.getPlan(input.planId);
    if (!plan) return { kind: "not_found", message: "Plan not found." };
    const action = plan.actions.find((candidate) => candidate.id === input.actionId);
    if (!action) return { kind: "not_found", message: "Action not found in this plan." };
    const member = await this.deps.households.getMember(input.ownerMemberId);
    if (!member || member.householdId !== plan.householdId) {
      return { kind: "not_found", message: "Household member not found for this plan." };
    }
    if (!input.confirm) {
      return {
        kind: "confirmation_required",
        message: `Assign "${action.title}" to ${member.displayName}?`,
        proposedChanges: [`owner: ${action.ownerLabel} -> ${member.displayName}`, `status: ${action.status} -> assigned`]
      };
    }

    const updated = withUpdatedAction(plan, action.id, (candidate) => ({
      ...candidate,
      ownerMemberId: member.id,
      ownerLabel: member.displayName,
      status: candidate.status === "done" ? "done" : "assigned"
    }));
    await this.deps.plans.savePlan(updated);
    await this.deps.trace.emit({
      planId: plan.id,
      type: "action.updated",
      status: "ok",
      tool: "assign_household_task",
      summary: `Action "${action.title}" assigned to ${member.displayName}.`
    });
    return { kind: "ok", plan: updated };
  }

  async updateActionStatus(input: UpdateActionStatusInput): Promise<ActionMutationResult> {
    const plan = await this.deps.plans.getPlan(input.planId);
    if (!plan) return { kind: "not_found", message: "Plan not found." };
    const action = plan.actions.find((candidate) => candidate.id === input.actionId);
    if (!action) return { kind: "not_found", message: "Action not found in this plan." };
    if (!input.confirm) {
      return {
        kind: "confirmation_required",
        message: `Mark "${action.title}" as ${input.status}?`,
        proposedChanges: [`status: ${action.status} -> ${input.status}`]
      };
    }

    const updated = withUpdatedAction(plan, action.id, (candidate) => ({
      ...candidate,
      status: input.status,
      ownerMemberId: input.status === "open" ? null : candidate.ownerMemberId
    }));
    await this.deps.plans.savePlan(updated);
    await this.deps.trace.emit({
      planId: plan.id,
      type: "action.updated",
      status: "ok",
      tool: "update_action_status",
      summary: `Action "${action.title}" marked ${input.status}.`
    });
    return { kind: "ok", plan: updated };
  }

  private async tryClassify(
    modelInput: PlanModelInput,
    planId: string,
    emit: (event: NewTraceEventInput) => Promise<AgentTraceEvent>
  ): Promise<Classification | null> {
    try {
      const classification = await withTimeout(this.deps.model.classify(modelInput), this.deps.config.modelTimeoutMs, "classification");
      return classification;
    } catch (error) {
      await emit({
        planId,
        type: "error",
        status: "error",
        provider: this.deps.model.name,
        model: this.deps.model.fastModel,
        summary: `Classification skipped: ${describe(error)}`
      });
      return null;
    }
  }

  private async planWithRetry(
    modelInput: PlanModelInput,
    planId: string,
    emit: (event: NewTraceEventInput) => Promise<AgentTraceEvent>
  ): Promise<PlanDraft & { degraded: boolean }> {
    let repairHint: string | null = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const started = Date.now();
      await emit({
        planId,
        type: "model.plan.requested",
        status: "ok",
        provider: this.deps.model.name,
        model: this.deps.model.planModel,
        summary: attempt === 1 ? "Requesting a structured plan draft." : "Retrying with the validation errors attached."
      });
      try {
        const raw = await withTimeout(
          this.deps.model.plan({ ...modelInput, repairHint }),
          this.deps.config.modelTimeoutMs,
          "model.plan"
        );
        const parsed = PlanDraftSchema.safeParse(raw);
        if (!parsed.success) {
          throw new Error(parsed.error.issues.map((issue) => `${issue.path.join(".") || "draft"}: ${issue.message}`).join("; "));
        }
        await emit({
          planId,
          type: "model.plan.received",
          status: "ok",
          provider: this.deps.model.name,
          model: this.deps.model.planModel,
          durationMs: Date.now() - started,
          summary: `Valid draft received (${parsed.data.actions.length} actions, urgency=${parsed.data.urgency}).`
        });
        return { ...parsed.data, degraded: false };
      } catch (error) {
        repairHint = describe(error);
        await emit({
          planId,
          type: "error",
          status: "error",
          provider: this.deps.model.name,
          model: this.deps.model.planModel,
          durationMs: Date.now() - started,
          summary: `Draft rejected: ${repairHint}`
        });
      }
    }

    await emit({
      planId,
      type: "model.plan.received",
      status: "degraded",
      provider: "deterministic-fallback",
      summary: "Model unavailable or invalid twice: using the deterministic fallback plan."
    });
    return { ...buildFallbackPlanDraft(modelInput), degraded: true };
  }

  private assemblePlan(args: {
    planId: string;
    intake: IssueIntake;
    household: Household;
    safety: SafetyAssessment;
    urgency: RepairPlan["urgency"];
    draft: PlanDraft;
    sources: Source[];
    researchStatus: ResearchStatus;
    degraded: boolean;
  }): RepairPlan {
    const { planId, household, safety, urgency, draft, sources, researchStatus, degraded } = args;
    return {
      id: planId,
      householdId: household.id,
      issueSummary: clamp(draft.issueSummary, 300),
      urgency,
      safetyFlags: safety.flags,
      safetyGuidance: safety.mandatoryGuidance,
      clarifyingQuestions: draft.clarifyingQuestions.slice(0, this.deps.config.maxClarifyingQuestions).map((question) => clamp(question, 200)),
      actions: draft.actions.slice(0, MAX_PLAN_ACTIONS).map((action) => {
        const owner = resolveOwner(household.members, action.ownerLabel);
        return {
          id: this.deps.ids.uuid(),
          title: clamp(action.title, 120),
          rationale: clamp(action.rationale, 400),
          ownerMemberId: owner.ownerMemberId,
          ownerLabel: clamp(owner.ownerLabel, 80),
          dueAt: action.dueAt,
          status: "open" as const,
          requiresConfirmation: action.requiresConfirmation || /contact|call|book|email|send|pay/i.test(action.title)
        };
      }),
      sources: dedupeSources(sources).slice(0, 8),
      researchStatus,
      degraded,
      createdAt: this.deps.clock.now().toISOString()
    };
  }

  private assembleClarificationPlan(args: {
    planId: string;
    intake: IssueIntake;
    household: Household;
    safety: SafetyAssessment;
    questions: string[];
  }): RepairPlan {
    const { planId, household, safety, questions } = args;
    const owner = resolveOwner(household.members, "household");
    return {
      id: planId,
      householdId: household.id,
      issueSummary: "One short round of questions before the plan is built.",
      urgency: safety.urgency,
      safetyFlags: safety.flags,
      safetyGuidance: safety.mandatoryGuidance,
      clarifyingQuestions: questions,
      actions: [
        {
          id: this.deps.ids.uuid(),
          title: "Answer the clarifying questions",
          rationale: "The answers change which actions are safe and useful, so they are asked before planning.",
          ownerMemberId: owner.ownerMemberId,
          ownerLabel: owner.ownerLabel,
          dueAt: null,
          status: "open",
          requiresConfirmation: false
        }
      ],
      sources: [],
      researchStatus: "skipped",
      degraded: false,
      createdAt: this.deps.clock.now().toISOString()
    };
  }
}

function degradedAwareStatus(plan: RepairPlan): "ok" | "degraded" {
  if (plan.degraded) return "degraded";
  return plan.researchStatus === "unavailable" ? "degraded" : "ok";
}

function withUpdatedAction(plan: RepairPlan, actionId: string, update: (action: PlanAction) => PlanAction): RepairPlan {
  return { ...plan, actions: plan.actions.map((action) => (action.id === actionId ? update(action) : action)) };
}

export function resolveOwner(members: HouseholdMember[], ownerLabel: string): { ownerMemberId: string | null; ownerLabel: string } {
  const needle = ownerLabel.trim().toLowerCase();
  const match = members.find((member) => {
    const name = member.displayName.toLowerCase();
    return name === needle || name.startsWith(needle) || needle.startsWith(name.split(" ")[0] ?? name);
  });
  if (match) return { ownerMemberId: match.id, ownerLabel: match.displayName };
  const fallback = members.find((member) => member.role === "adult") ?? members[0];
  if (fallback) return { ownerMemberId: fallback.id, ownerLabel: fallback.displayName };
  return { ownerMemberId: null, ownerLabel: ownerLabel || "Household" };
}

export function buildSearchQuery(intake: IssueIntake, household: Household | null, issueType: IssueType | null): string {
  const place = household?.city ?? "UK";
  const topic =
    issueType === null || issueType === "boiler"
      ? "boiler repair Gas Safe registered engineer"
      : `${issueType} repair qualified tradesperson`;
  return `${topic} ${place}`.slice(0, 280);
}

/** Keeps the plan inside the product contract without discarding an otherwise valid draft. */
function clamp(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}\u2026`;
}

function dedupeSources(sources: Source[]): Source[] {
  const seen = new Set<string>();
  const unique: Source[] = [];
  for (const source of sources) {
    const key = source.url.replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(source);
  }
  return unique;
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.length > 200 ? `${message.slice(0, 197)}...` : message;
}
