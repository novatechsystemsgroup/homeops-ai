import { eq } from "drizzle-orm";
import type { Household, HouseholdMember } from "@homeops/contracts";
import { HouseholdSchema, HouseholdMemberSchema } from "@homeops/contracts";
import type { DatabaseHandle } from "../client";
import { householdMembers, households } from "../schema";

export interface HouseholdStore {
  getHousehold(householdId: string): Promise<Household | null>;
  listHouseholds(): Promise<Household[]>;
  listMembers(householdId: string): Promise<HouseholdMember[]>;
  getMember(memberId: string): Promise<HouseholdMember | null>;
  saveHousehold(household: Household): Promise<void>;
  deleteHousehold(householdId: string): Promise<boolean>;
}

export function createHouseholdStore(handle: DatabaseHandle): HouseholdStore {
  const { db } = handle;

  const readMembers = (householdId: string): HouseholdMember[] =>
    db
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.householdId, householdId))
      .all()
      .map((row) =>
        HouseholdMemberSchema.parse({
          id: row.id,
          householdId: row.householdId,
          displayName: row.displayName,
          role: row.role,
          prefersContact: row.prefersContact
        })
      );

  return {
    async getHousehold(householdId) {
      const row = db.select().from(households).where(eq(households.id, householdId)).get();
      if (!row) return null;
      return HouseholdSchema.parse({
        id: row.id,
        name: row.name,
        city: row.city,
        isSynthetic: row.isSynthetic,
        createdAt: row.createdAt,
        members: readMembers(row.id)
      });
    },

    async listHouseholds() {
      return db
        .select()
        .from(households)
        .all()
        .map((row) =>
          HouseholdSchema.parse({
            id: row.id,
            name: row.name,
            city: row.city,
            isSynthetic: row.isSynthetic,
            createdAt: row.createdAt,
            members: readMembers(row.id)
          })
        );
    },

    async listMembers(householdId) {
      return readMembers(householdId);
    },

    async getMember(memberId) {
      const row = db.select().from(householdMembers).where(eq(householdMembers.id, memberId)).get();
      if (!row) return null;
      return HouseholdMemberSchema.parse({
        id: row.id,
        householdId: row.householdId,
        displayName: row.displayName,
        role: row.role,
        prefersContact: row.prefersContact
      });
    },

    async saveHousehold(household) {
      const parsed = HouseholdSchema.parse(household);
      db.transaction((tx) => {
        tx.insert(households)
          .values({
            id: parsed.id,
            name: parsed.name,
            city: parsed.city,
            isSynthetic: parsed.isSynthetic,
            createdAt: parsed.createdAt
          })
          .onConflictDoUpdate({
            target: households.id,
            set: { name: parsed.name, city: parsed.city, isSynthetic: parsed.isSynthetic }
          })
          .run();
        for (const member of parsed.members) {
          tx.insert(householdMembers)
            .values({
              id: member.id,
              householdId: member.householdId,
              displayName: member.displayName,
              role: member.role,
              prefersContact: member.prefersContact
            })
            .onConflictDoUpdate({
              target: householdMembers.id,
              set: { displayName: member.displayName, role: member.role, prefersContact: member.prefersContact }
            })
            .run();
        }
      });
    },

    async deleteHousehold(householdId) {
      const existing = db.select({ id: households.id }).from(households).where(eq(households.id, householdId)).get();
      if (!existing) return false;
      // Trace rows are not linked by a foreign key (they also cover non-persisted
      // clarification rounds), so "delete demo household" removes them explicitly.
      handle.raw
        .prepare("DELETE FROM trace_events WHERE plan_id IN (SELECT id FROM plans WHERE household_id = ?)")
        .run(householdId);
      db.delete(households).where(eq(households.id, householdId)).run();
      return true;
    }
  };
}
