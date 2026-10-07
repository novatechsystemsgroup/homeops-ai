import type { AgentTraceEvent, ApiMeta, Household, PlanAction, RepairPlan } from "@homeops/contracts";

export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787").replace(/\/$/, "");

export interface CreatePlanResponse {
  plan: RepairPlan;
  trace: AgentTraceEvent[];
  clarificationRequired: boolean;
}

export interface PlanEnvelope {
  plan: RepairPlan;
  trace: AgentTraceEvent[];
  openActions: PlanAction[];
}

export interface MutationResponse {
  status: "ok" | "confirmation_required";
  plan?: RepairPlan;
  message?: string;
  proposedChanges?: string[];
}

export type ApiMetaResponse = ApiMeta & { searchDescription?: string; degradedProviders?: string[] };

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) }
  });

  if (!response.ok) {
    let detail = response.statusText;
    let code: string | undefined;
    try {
      const problem = (await response.json()) as { detail?: string; title?: string; code?: string };
      detail = problem.detail ?? problem.title ?? detail;
      code = problem.code;
    } catch {
      // keep the status text
    }
    throw new ApiRequestError(detail || "Request failed", response.status, code);
  }

  return (await response.json()) as T;
}

export interface SafetyAssessmentResponse {
  assessment: {
    urgency: RepairPlan["urgency"];
    flags: RepairPlan["safetyFlags"];
    ruleIds: string[];
    mandatoryGuidance: string[];
    callEmergencyServices: boolean;
  };
}

export const api = {
  meta: () => request<ApiMetaResponse>("/api/meta"),
  safetyGuidance: (description: string) =>
    request<SafetyAssessmentResponse>("/api/safety-guidance", { method: "POST", body: JSON.stringify({ description }) }),
  demoHousehold: () => request<Household>("/api/households/demo"),
  createPlan: (body: { householdId: string; description: string; clarificationAnswers?: string[] }) =>
    request<CreatePlanResponse>("/api/plans", { method: "POST", body: JSON.stringify(body) }),
  plan: (planId: string) => request<PlanEnvelope>(`/api/plans/${planId}`),
  assign: (planId: string, actionId: string, ownerMemberId: string) =>
    request<MutationResponse>(`/api/plans/${planId}/actions/${actionId}/assign`, {
      method: "POST",
      body: JSON.stringify({ ownerMemberId, confirm: true })
    }),
  updateStatus: (planId: string, actionId: string, status: PlanAction["status"]) =>
    request<MutationResponse>(`/api/plans/${planId}/actions/${actionId}/status`, {
      method: "POST",
      body: JSON.stringify({ status, confirm: true })
    }),
  deleteDemoData: (householdId: string) => request<{ deleted: boolean }>(`/api/households/${householdId}`, { method: "DELETE" })
};
