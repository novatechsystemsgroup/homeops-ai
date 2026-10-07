import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { desc, eq, inArray } from "drizzle-orm";
import type { Evidence } from "@homeops/contracts";
import { EvidenceSchema } from "@homeops/contracts";
import type { DatabaseHandle } from "../client";
import { evidence, plans } from "../schema";

export interface EvidenceStore {
  save(record: Evidence, bytes: Buffer): Promise<void>;
  get(evidenceId: string): Promise<{ record: Evidence; bytes: Buffer } | null>;
  listForPlan(planId: string): Promise<Evidence[]>;
  delete(evidenceId: string): Promise<boolean>;
  /** Removes metadata rows and files for every plan of a household (demo data reset). */
  deleteForHousehold(householdId: string): Promise<number>;
}

export function createEvidenceRepository(handle: DatabaseHandle, baseDir: string): EvidenceStore {
  const { db } = handle;
  const filesDir = join(baseDir, "evidence");
  mkdirSync(filesDir, { recursive: true });

  const filePath = (id: string): string => join(filesDir, id);

  const toDomain = (row: typeof evidence.$inferSelect): Evidence =>
    EvidenceSchema.parse({
      id: row.id,
      planId: row.planId,
      actionId: row.actionId,
      kind: row.kind,
      contentType: row.contentType,
      byteSize: row.byteSize,
      originalName: row.originalName,
      note: row.note,
      metadataStripped: row.metadataStripped,
      createdAt: row.createdAt
    });

  const removeFile = (id: string): void => {
    const path = filePath(id);
    if (existsSync(path)) rmSync(path, { force: true });
  };

  return {
    async save(record, bytes) {
      const parsed = EvidenceSchema.parse(record);
      // The directory can be removed underneath a running process (test resets, volume
      // mounts), so it is ensured on every write rather than only at startup.
      mkdirSync(filesDir, { recursive: true });
      writeFileSync(filePath(parsed.id), bytes);
      db.insert(evidence)
        .values({
          id: parsed.id,
          planId: parsed.planId,
          actionId: parsed.actionId,
          kind: parsed.kind,
          contentType: parsed.contentType,
          byteSize: parsed.byteSize,
          originalName: parsed.originalName,
          note: parsed.note,
          metadataStripped: parsed.metadataStripped,
          createdAt: parsed.createdAt
        })
        .run();
    },

    async get(evidenceId) {
      const row = db.select().from(evidence).where(eq(evidence.id, evidenceId)).get();
      if (!row) return null;
      const path = filePath(row.id);
      if (!existsSync(path)) return null;
      return { record: toDomain(row), bytes: readFileSync(path) };
    },

    async listForPlan(planId) {
      return db
        .select()
        .from(evidence)
        .where(eq(evidence.planId, planId))
        .orderBy(desc(evidence.createdAt))
        .all()
        .map(toDomain);
    },

    async delete(evidenceId) {
      const row = db.select({ id: evidence.id }).from(evidence).where(eq(evidence.id, evidenceId)).get();
      if (!row) return false;
      db.delete(evidence).where(eq(evidence.id, evidenceId)).run();
      removeFile(evidenceId);
      return true;
    },

    async deleteForHousehold(householdId) {
      const planIds = db
        .select({ id: plans.id })
        .from(plans)
        .where(eq(plans.householdId, householdId))
        .all()
        .map((row) => row.id);
      if (planIds.length === 0) return 0;
      const rows = db.select({ id: evidence.id }).from(evidence).where(inArray(evidence.planId, planIds)).all();
      for (const row of rows) {
        db.delete(evidence).where(eq(evidence.id, row.id)).run();
        removeFile(row.id);
      }
      return rows.length;
    }
  };
}
