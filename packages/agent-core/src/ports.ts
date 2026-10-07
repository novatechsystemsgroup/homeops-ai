import type {
  AgentTraceEvent,
  Classification,
  Evidence,
  Household,
  HouseholdMember,
  IssueIntake,
  IssueType,
  MaintenanceTask,
  PlanDraft,
  RepairPlan,
  SafetyAssessment,
  Source,
  TraceEventType,
  TraceStatus
} from "@homeops/contracts";

export interface PlanModelInput {
  intake: IssueIntake;
  household: Household | null;
  safety: SafetyAssessment;
  /** Detected domain of the problem; drives prompts, research and the fallback plan. */
  issueType: IssueType;
  /** ISO timestamp used for relative deadlines ("before Saturday"). */
  today: string;
  /** Set on a retry so the model can repair a rejected draft. */
  repairHint?: string | null;
}

export interface ModelProvider {
  readonly name: string;
  readonly planModel: string | null;
  readonly fastModel: string | null;
  classify(input: PlanModelInput): Promise<Classification>;
  plan(input: PlanModelInput): Promise<PlanDraft>;
}

export interface SearchOptions {
  limit: number;
  location: string | null;
  /** When set, providers should prefer (and if necessary restrict to) these domains. */
  includeDomains?: string[];
  /** Domains that never add value to a household plan (forums, video, social). */
  excludeDomains?: string[];
}

export interface SearchProvider {
  readonly name: string;
  readonly description: string;
  search(query: string, options: SearchOptions): Promise<Source[]>;
}

export interface PlanRepository {
  savePlan(plan: RepairPlan): Promise<void>;
  getPlan(planId: string): Promise<RepairPlan | null>;
  listOpenPlans(householdId: string): Promise<RepairPlan[]>;
}

export interface MaintenanceRepository {
  list(householdId: string): Promise<MaintenanceTask[]>;
  get(taskId: string): Promise<MaintenanceTask | null>;
  save(task: MaintenanceTask): Promise<void>;
  delete(taskId: string): Promise<boolean>;
}

export interface EvidenceRepository {
  save(record: Evidence, bytes: Buffer): Promise<void>;
  get(evidenceId: string): Promise<{ record: Evidence; bytes: Buffer } | null>;
  listForPlan(planId: string): Promise<Evidence[]>;
  delete(evidenceId: string): Promise<boolean>;
  deleteForHousehold(householdId: string): Promise<number>;
}

export interface HouseholdRepository {
  getHousehold(householdId: string): Promise<Household | null>;
  listMembers(householdId: string): Promise<HouseholdMember[]>;
  getMember(memberId: string): Promise<HouseholdMember | null>;
}

export interface NewTraceEventInput {
  planId: string | null;
  type: TraceEventType;
  status: TraceStatus;
  summary: string;
  durationMs?: number | null;
  provider?: string | null;
  model?: string | null;
  tool?: string | null;
}

export interface TraceSink {
  emit(event: NewTraceEventInput): Promise<AgentTraceEvent>;
  listByPlan(planId: string): Promise<AgentTraceEvent[]>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  uuid(): string;
}
