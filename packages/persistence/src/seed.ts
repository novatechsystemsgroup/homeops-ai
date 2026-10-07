import type { Household } from "@homeops/contracts";
import type { HouseholdStore } from "./repositories/household-repository";

/** Fictional demo household. No real names, addresses or phone numbers anywhere. */
export const DEMO_HOUSEHOLD = {
  id: "0f5c9a52-4a1e-4c1b-9a53-2f8f6d1a7b31",
  name: "Hartley household",
  city: "Bristol",
  members: [
    { id: "1a2b3c4d-1111-4a2b-9c3d-000000000001", displayName: "Alex Hartley", role: "adult", prefersContact: "in_person" },
    { id: "1a2b3c4d-1111-4a2b-9c3d-000000000002", displayName: "Priya Hartley", role: "adult", prefersContact: "text" },
    { id: "1a2b3c4d-1111-4a2b-9c3d-000000000003", displayName: "Sam Hartley", role: "child", prefersContact: "unavailable" },
    { id: "1a2b3c4d-1111-4a2b-9c3d-000000000004", displayName: "Margaret Hughes", role: "vulnerable", prefersContact: "phone" }
  ]
} as const;

export function buildDemoHousehold(createdAt: string): Household {
  return {
    id: DEMO_HOUSEHOLD.id,
    name: DEMO_HOUSEHOLD.name,
    city: DEMO_HOUSEHOLD.city,
    isSynthetic: true,
    createdAt,
    members: DEMO_HOUSEHOLD.members.map((member) => ({
      id: member.id,
      householdId: DEMO_HOUSEHOLD.id,
      displayName: member.displayName,
      role: member.role,
      prefersContact: member.prefersContact
    }))
  };
}

export async function seedDemoHousehold(store: HouseholdStore, createdAt: string): Promise<Household> {
  const household = buildDemoHousehold(createdAt);
  await store.saveHousehold(household);
  return household;
}
