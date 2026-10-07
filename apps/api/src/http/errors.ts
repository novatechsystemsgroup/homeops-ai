import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ApiProblemSchema } from "@homeops/contracts";
import type { DomainError } from "@homeops/agent-core";

const TITLES: Record<string, string> = {
  invalid_request: "Invalid request",
  household_required: "Household required",
  household_not_found: "Household not found",
  plan_not_found: "Plan not found",
  not_found: "Not found",
  internal_error: "Internal error"
};

export function problemResponse(
  c: Context,
  init: { status: number; code: string; detail: string; title?: string }
): Response {
  const body = ApiProblemSchema.parse({
    type: `https://homeops.ai/problems/${init.code}`,
    title: init.title ?? TITLES[init.code] ?? "Request failed",
    status: init.status,
    code: init.code,
    detail: init.detail
  });
  return c.json(body, init.status as ContentfulStatusCode);
}

export function domainErrorResponse(c: Context, error: DomainError): Response {
  return problemResponse(c, { status: error.httpStatus, code: error.code, detail: error.message });
}

/** Invalid payloads get a readable field list, never a stack trace. */
export function validationDetail(issues: Array<{ path: PropertyKey[]; message: string }>): string {
  return issues
    .slice(0, 5)
    .map((issue) => `${issue.path.map(String).join(".") || "body"}: ${issue.message}`)
    .join("; ");
}
