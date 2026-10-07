import { describe, expect, it } from "vitest";
import { assessSafety } from "./rules";
import { GAS_EMERGENCY_NUMBER_UK } from "./copy";

const FIXTURES = [
  {
    id: "boiler-noise-benign",
    text: "The boiler is making a loud humming noise and we have guests on Saturday. We still have hot water. No smell of gas.",
    urgency: "needs_attention",
    flags: ["appliance_noise"],
    emergency: false
  },
  {
    id: "gas-smell",
    text: "There is a smell of gas near the boiler cupboard.",
    urgency: "emergency",
    flags: ["possible_gas"],
    emergency: true
  },
  {
    id: "smoke",
    text: "There is smoke coming from behind the boiler and a burning smell.",
    urgency: "emergency",
    flags: ["smoke_or_burning"],
    emergency: true
  },
  {
    id: "water-near-socket",
    text: "Water is dripping from under the sink right next to a socket.",
    urgency: "emergency",
    flags: ["water_near_electricity"],
    emergency: true
  },
  {
    id: "carbon-monoxide",
    text: "The carbon monoxide alarm went off this morning next to the boiler.",
    urgency: "emergency",
    flags: ["carbon_monoxide"],
    emergency: true
  },
  {
    id: "no-heat-with-baby",
    text: "No heating or hot water since last night and we have a baby in the house.",
    urgency: "urgent",
    flags: ["no_heat_or_hot_water", "vulnerable_occupant"],
    emergency: false
  },
  {
    id: "no-heat-plain",
    text: "The boiler is broken and we have no hot water.",
    urgency: "urgent",
    flags: ["no_heat_or_hot_water"],
    emergency: false
  }
] as const;

describe("deterministic safety triage", () => {
  for (const fixture of FIXTURES) {
    it(`classifies ${fixture.id} as ${fixture.urgency}`, () => {
      const assessment = assessSafety({ description: fixture.text, occupancyNotes: null });
      expect(assessment.urgency).toBe(fixture.urgency);
      expect(assessment.callEmergencyServices).toBe(fixture.emergency);
      for (const flag of fixture.flags) expect(assessment.flags).toContain(flag);
    });
  }

  it("never treats a gas emergency as an emergency-free case", () => {
    const assessment = assessSafety({ description: "I can smell gas in the kitchen", occupancyNotes: null });
    expect(assessment.callEmergencyServices).toBe(true);
    expect(assessment.mandatoryGuidance.join(" ")).toContain(GAS_EMERGENCY_NUMBER_UK);
  });

  it("respects negation so a ruled-out gas smell does not fire the gas rule", () => {
    const assessment = assessSafety({ description: "The boiler is noisy but there is no smell of gas at all.", occupancyNotes: null });
    expect(assessment.flags).not.toContain("possible_gas");
    expect(assessment.urgency).not.toBe("emergency");
    expect(assessment.negatedTriggers).toContain("GAS_001");
  });

  it("escalates loss of heating with a vulnerable occupant to at least urgent", () => {
    const assessment = assessSafety({ description: "No heating and my elderly mother lives with us.", occupancyNotes: null });
    expect(assessment.flags).toContain("vulnerable_occupant");
    expect(assessment.ruleIds).toContain("HEAT_002");
  });

  it("does not treat a hope to keep hot water as a loss of hot water", () => {
    const assessment = assessSafety({
      description: "The boiler is noisy and I do not want to be without hot water before Saturday.",
      occupancyNotes: null
    });
    expect(assessment.flags).not.toContain("no_heat_or_hot_water");
    expect(assessment.urgency).toBe("needs_attention");
    expect(assessment.negatedTriggers).toContain("HEAT_003");
  });

  it("returns monitor for a routine request with no risk signals", () => {
    const assessment = assessSafety({ description: "I would like to plan a yearly boiler service.", occupancyNotes: null });
    expect(assessment.urgency).toBe("monitor");
    expect(assessment.flags).toEqual([]);
  });

  it("never returns guidance without a rule id behind it", () => {
    for (const fixture of FIXTURES) {
      const assessment = assessSafety({ description: fixture.text, occupancyNotes: null });
      if (assessment.mandatoryGuidance.length > 0) expect(assessment.ruleIds.length).toBeGreaterThan(0);
    }
  });
});
