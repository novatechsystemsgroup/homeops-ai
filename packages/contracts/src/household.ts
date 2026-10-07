import { z } from "zod";
import { HouseholdIdSchema, MemberIdSchema } from "./ids";

export const MemberRoleSchema = z.enum(["adult", "child", "guest", "vulnerable"]);
export const ContactPreferenceSchema = z.enum(["phone", "text", "in_person", "unavailable"]);

export const HouseholdMemberSchema = z.object({
  id: MemberIdSchema,
  householdId: HouseholdIdSchema,
  displayName: z.string().min(1).max(80),
  role: MemberRoleSchema,
  prefersContact: ContactPreferenceSchema
});

/** Demo households are always synthetic; the literal guards against real data creeping in. */
export const HouseholdSchema = z.object({
  id: HouseholdIdSchema,
  name: z.string().min(1).max(120),
  city: z.string().min(1).max(80),
  isSynthetic: z.literal(true),
  members: z.array(HouseholdMemberSchema),
  createdAt: z.iso.datetime()
});

export type MemberRole = z.infer<typeof MemberRoleSchema>;
export type ContactPreference = z.infer<typeof ContactPreferenceSchema>;
export type HouseholdMember = z.infer<typeof HouseholdMemberSchema>;
export type Household = z.infer<typeof HouseholdSchema>;
