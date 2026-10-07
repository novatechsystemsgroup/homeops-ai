import type {
  AgentTraceEvent,
  ApiMeta,
  EvidenceKind,
  EvidenceWithUrl,
  Household,
  MaintenanceCadence,
  MaintenanceTaskView,
  PlanAction,
  RepairPlan
} from "@homeops/contracts";

// An explicitly empty value means "same origin": in production the web container
// proxies /api to the API container, so no cross-origin traffic exists at all.
const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

export const API_BASE = (configuredApiBase === undefined ? "http://localhost:8787" : configuredApiBase).replace(/\/$/, "");

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

export interface MaintenanceListResponse {
  householdId: string;
  tasks: MaintenanceTaskView[];
}

export interface MaintenanceMutationResponse {
  status: "ok" | "confirmation_required";
  task?: MaintenanceTaskView;
  message?: string;
  proposedChanges?: string[];
}

export interface EvidenceListResponse {
  planId: string;
  evidence: EvidenceWithUrl[];
}

/** Multipart upload: the browser must set the content-type boundary itself. */
async function requestForm<T>(path: string, form: FormData): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { method: "POST", body: form, cache: "no-store" });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const problem = (await response.json()) as { detail?: string; title?: string };
      detail = problem.detail ?? problem.title ?? detail;
    } catch {
      // keep the status text
    }
    throw new ApiRequestError(detail || "Upload failed", response.status);
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
  deleteDemoData: (householdId: string) => request<{ deleted: boolean }>(`/api/households/${householdId}`, { method: "DELETE" }),

  maintenance: (householdId: string) => request<MaintenanceListResponse>(`/api/maintenance?householdId=${encodeURIComponent(householdId)}`),
  createMaintenance: (body: { householdId: string; title: string; cadence: MaintenanceCadence; instructions?: string; nextDueAt?: string | null }) =>
    request<{ task: MaintenanceTaskView }>("/api/maintenance", { method: "POST", body: JSON.stringify(body) }),
  completeMaintenance: (taskId: string, confirm: boolean) =>
    request<MaintenanceMutationResponse>(`/api/maintenance/${taskId}/complete`, { method: "POST", body: JSON.stringify({ confirm }) }),
  deleteMaintenance: (taskId: string) => request<{ deleted: boolean }>(`/api/maintenance/${taskId}`, { method: "DELETE" }),

  evidence: (planId: string) => request<EvidenceListResponse>(`/api/evidence/plan/${planId}`),
  uploadEvidence: (planId: string, input: { actionId: string | null; kind: EvidenceKind; file: File | Blob; filename: string; note?: string | null }) => {
    const form = new FormData();
    form.set("kind", input.kind);
    if (input.actionId) form.set("actionId", input.actionId);
    if (input.note) form.set("note", input.note);
    form.set("file", input.file, input.filename);
    return requestForm<{ evidence: EvidenceWithUrl }>(`/api/evidence/plan/${planId}`, form);
  },
  deleteEvidence: (evidenceId: string) => request<{ deleted: boolean }>(`/api/evidence/${evidenceId}`, { method: "DELETE" }),
  evidenceUrl: (evidenceId: string) => `${API_BASE}/api/evidence/${evidenceId}`
};
