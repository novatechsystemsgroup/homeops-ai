import { asc, eq } from "drizzle-orm";
import type { MaintenanceTask } from "@homeops/contracts";
import { MaintenanceTaskSchema } from "@homeops/contracts";
import type { DatabaseHandle } from "../client";
import { maintenanceTasks } from "../schema";

export interface MaintenanceStore {
  list(householdId: string): Promise<MaintenanceTask[]>;
  listAll(): Promise<MaintenanceTask[]>;
  get(taskId: string): Promise<MaintenanceTask | null>;
  save(task: MaintenanceTask): Promise<void>;
  delete(taskId: string): Promise<boolean>;
}

export function createMaintenanceRepository(handle: DatabaseHandle): MaintenanceStore {
  const { db } = handle;

  const toDomain = (row: typeof maintenanceTasks.$inferSelect): MaintenanceTask =>
    MaintenanceTaskSchema.parse({
      id: row.id,
      householdId: row.householdId,
      title: row.title,
      instructions: row.instructions,
      category: row.category,
      cadence: row.cadence,
      nextDueAt: row.nextDueAt,
      lastCompletedAt: row.lastCompletedAt,
      sourcePlanId: row.sourcePlanId,
      createdAt: row.createdAt
    });

  return {
    async list(householdId) {
      return db
        .select()
        .from(maintenanceTasks)
        .where(eq(maintenanceTasks.householdId, householdId))
        .orderBy(asc(maintenanceTasks.nextDueAt))
        .all()
        .map(toDomain);
    },

    async listAll() {
      return db.select().from(maintenanceTasks).orderBy(asc(maintenanceTasks.nextDueAt)).all().map(toDomain);
    },

    async get(taskId) {
      const row = db.select().from(maintenanceTasks).where(eq(maintenanceTasks.id, taskId)).get();
      return row ? toDomain(row) : null;
    },

    async save(task) {
      const parsed = MaintenanceTaskSchema.parse(task);
      db.insert(maintenanceTasks)
        .values({
          id: parsed.id,
          householdId: parsed.householdId,
          title: parsed.title,
          instructions: parsed.instructions,
          category: parsed.category,
          cadence: parsed.cadence,
          nextDueAt: parsed.nextDueAt,
          lastCompletedAt: parsed.lastCompletedAt,
          sourcePlanId: parsed.sourcePlanId,
          createdAt: parsed.createdAt
        })
        .onConflictDoUpdate({
          target: maintenanceTasks.id,
          set: {
            title: parsed.title,
            instructions: parsed.instructions,
            category: parsed.category,
            cadence: parsed.cadence,
            nextDueAt: parsed.nextDueAt,
            lastCompletedAt: parsed.lastCompletedAt,
            sourcePlanId: parsed.sourcePlanId
          }
        })
        .run();
    },

    async delete(taskId) {
      const existing = db.select({ id: maintenanceTasks.id }).from(maintenanceTasks).where(eq(maintenanceTasks.id, taskId)).get();
      if (!existing) return false;
      db.delete(maintenanceTasks).where(eq(maintenanceTasks.id, taskId)).run();
      return true;
    }
  };
}
