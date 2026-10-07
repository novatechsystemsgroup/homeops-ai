import { asc, eq, isNull, sql } from "drizzle-orm";
import type { AgentTraceEvent } from "@homeops/contracts";
import { AgentTraceEventSchema } from "@homeops/contracts";
import type { DatabaseHandle } from "../client";
import type { Clock, IdGenerator, NewTraceEventInput, TraceSink } from "@homeops/agent-core";
import { traceEvents } from "../schema";

export function createTraceRepository(handle: DatabaseHandle, ids: IdGenerator, clock: Clock): TraceSink {
  const { db } = handle;

  const nextSeq = (planId: string | null): number => {
    const row = db
      .select({ maxSeq: sql<number | null>`max(${traceEvents.seq})` })
      .from(traceEvents)
      .where(planId === null ? isNull(traceEvents.planId) : eq(traceEvents.planId, planId))
      .get();
    return (row?.maxSeq ?? 0) + 1;
  };

  const toDomain = (row: typeof traceEvents.$inferSelect): AgentTraceEvent =>
    AgentTraceEventSchema.parse({
      id: row.id,
      planId: row.planId,
      seq: row.seq,
      type: row.type,
      at: row.at,
      durationMs: row.durationMs,
      provider: row.provider,
      model: row.model,
      tool: row.tool,
      status: row.status,
      summary: row.summary
    });

  return {
    async emit(event: NewTraceEventInput) {
      const stored = AgentTraceEventSchema.parse({
        id: ids.uuid(),
        planId: event.planId,
        seq: nextSeq(event.planId),
        type: event.type,
        at: clock.now().toISOString(),
        durationMs: event.durationMs ?? null,
        provider: event.provider ?? null,
        model: event.model ?? null,
        tool: event.tool ?? null,
        status: event.status,
        summary: event.summary.slice(0, 300)
      });

      db.insert(traceEvents)
        .values({
          id: stored.id,
          planId: stored.planId,
          seq: stored.seq,
          type: stored.type,
          at: stored.at,
          durationMs: stored.durationMs,
          provider: stored.provider,
          model: stored.model,
          tool: stored.tool,
          status: stored.status,
          summary: stored.summary
        })
        .run();

      return stored;
    },

    async listByPlan(planId) {
      return db
        .select()
        .from(traceEvents)
        .where(eq(traceEvents.planId, planId))
        .orderBy(asc(traceEvents.seq))
        .all()
        .map(toDomain);
    }
  };
}
