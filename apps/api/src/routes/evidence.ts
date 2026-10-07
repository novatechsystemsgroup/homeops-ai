import { Hono } from "hono";
import type { EvidenceKind } from "@homeops/contracts";
import { DomainError } from "@homeops/agent-core";
import { problemResponse } from "../http/errors";
import type { Container } from "../container";

const KINDS: EvidenceKind[] = ["photo", "voice_note", "note"];

function asKind(value: unknown): EvidenceKind | null {
  return typeof value === "string" && (KINDS as string[]).includes(value) ? (value as EvidenceKind) : null;
}

/**
 * Repair evidence: photos, voice notes and written notes attached to a plan action.
 * Bytes are stored on disk next to the database; only metadata lives in SQLite.
 */
export function evidenceRoutes(container: Container): Hono {
  const app = new Hono();

  app.get("/plan/:planId", async (c) => {
    const planId = c.req.param("planId");
    const evidence = await container.service.listEvidence(planId);
    return c.json({ planId, evidence });
  });

  app.post("/plan/:planId", async (c) => {
    const planId = c.req.param("planId");
    let body: Record<string, unknown>;
    try {
      body = (await c.req.parseBody()) as Record<string, unknown>;
    } catch {
      return problemResponse(c, { status: 400, code: "invalid_request", detail: "Expected multipart/form-data with a file field." });
    }

    const file = body.file;
    if (!(file instanceof File)) {
      return problemResponse(c, { status: 400, code: "invalid_request", detail: "A file field is required." });
    }
    const kind = asKind(body.kind);
    if (!kind) {
      return problemResponse(c, { status: 400, code: "invalid_request", detail: "kind must be photo, voice_note or note." });
    }

    const actionId = typeof body.actionId === "string" && body.actionId !== "" ? body.actionId : null;
    const note = typeof body.note === "string" && body.note.trim() !== "" ? body.note.trim().slice(0, 500) : null;

    try {
      const evidence = await container.service.attachEvidence({
        planId,
        actionId,
        kind,
        contentType: file.type || "application/octet-stream",
        originalName: file.name ? file.name.slice(0, 160) : null,
        note,
        bytes: Buffer.from(await file.arrayBuffer())
      });
      return c.json({ evidence }, 201);
    } catch (error) {
      if (error instanceof DomainError) return problemResponse(c, { status: error.httpStatus, code: error.code, detail: error.message });
      throw error;
    }
  });

  // Bytes are served with their stored content type; nothing else is exposed.
  app.get("/:evidenceId", async (c) => {
    const found = await container.service.getEvidence(c.req.param("evidenceId"));
    if (!found) return problemResponse(c, { status: 404, code: "not_found", detail: "Evidence not found." });
    return new Response(new Uint8Array(found.bytes), {
      status: 200,
      headers: {
        "content-type": found.record.contentType,
        "content-length": String(found.bytes.length),
        "cache-control": "private, max-age=60"
      }
    });
  });

  app.delete("/:evidenceId", async (c) => {
    const deleted = await container.service.deleteEvidence(c.req.param("evidenceId"));
    if (!deleted) return problemResponse(c, { status: 404, code: "not_found", detail: "Evidence not found." });
    return c.json({ deleted: true });
  });

  return app;
}
