import type { IssueIntake, SafetyAssessment, SafetyFlag, Urgency } from "@homeops/contracts";
import { URGENCY_RANK } from "@homeops/contracts";
import {
  APPLIANCE_FAULT_GUIDANCE,
  BOILER_NOISE_GUIDANCE,
  CARBON_MONOXIDE_GUIDANCE,
  ELECTRICAL_GUIDANCE,
  FIRE_GUIDANCE,
  GAS_GUIDANCE,
  HEAT_LOSS_GUIDANCE,
  WATER_LEAK_GUIDANCE
} from "./copy";

interface SafetyRule {
  id: string;
  flag: SafetyFlag;
  urgency: Urgency;
  patterns: RegExp[];
  guidance: string[];
  callEmergencyServices: boolean;
}

/**
 * The triage table. Every rule is deterministic and reviewable; a language
 * model is never allowed to decide whether a situation is dangerous.
 */
export const SAFETY_RULES: SafetyRule[] = [
  {
    id: "GAS_001",
    flag: "possible_gas",
    urgency: "emergency",
    callEmergencyServices: true,
    patterns: [
      /\b(?:smell|smells|smelling|odour|odor|miros|miroase)\b[^.!?]{0,30}\b(?:gas|gaz)\b/i,
      /\b(?:gas|gaz)\b[^.!?]{0,30}\b(?:smell|leak|leaking|escape|hiss|hissing|miros|scurgere|scurge)\b/i,
      /\bgas\s+leak\b/i,
      /\bhiss(?:ing)?\b/i
    ],
    guidance: GAS_GUIDANCE
  },
  {
    id: "FIRE_001",
    flag: "smoke_or_burning",
    urgency: "emergency",
    callEmergencyServices: true,
    patterns: [
      /\b(?:smoke|smoking|smouldering|burning|burnt|fire|flames|sparks|sparking|fum|flacari|flăcări|scantei|scânteie|inceput de incendiu)\b/i
    ],
    guidance: FIRE_GUIDANCE
  },
  {
    id: "ELEC_001",
    flag: "water_near_electricity",
    urgency: "emergency",
    callEmergencyServices: true,
    patterns: [
      /\b(?:water|leak|leaking|drip|dripping|flood|flooding|puddle|apa|apă|scurgere|inundatie|inundație)\b[^.!?]{0,80}\b(?:socket|plug|outlet|socket\s?box|electric|electrical|electrics|wiring|fuse\s?box|consumer\s?unit|priza|priză)\b/i,
      /\b(?:socket|plug|outlet|socket\s?box|electric|electrical|electrics|wiring|fuse\s?box|consumer\s?unit|priza|priză)\b[^.!?]{0,80}\b(?:water|leak|leaking|drip|dripping|flood|flooding|puddle|wet|soaked|apa|apă|scurgere|ud)\b/i
    ],
    guidance: ELECTRICAL_GUIDANCE
  },
  {
    id: "CO_001",
    flag: "carbon_monoxide",
    urgency: "emergency",
    callEmergencyServices: true,
    patterns: [/\b(?:carbon monoxide|co alarm|co detector|monoxid(?: de carbon)?)\b/i],
    guidance: CARBON_MONOXIDE_GUIDANCE
  },
  {
    id: "HEAT_003",
    flag: "no_heat_or_hot_water",
    urgency: "urgent",
    callEmergencyServices: false,
    patterns: [
      /\bno\s+(?:heat|heating|hot water)\b/i,
      /\bwithout\s+(?:heat|heating|hot water)\b/i,
      /\b(?:heating|hot water|boiler)\b[^.!?]{0,30}\b(?:is\s+)?(?:off|broken|dead|not working|failed|stopped working)\b/i,
      /\bnu\s+avem\s+(?:apa calda|apă caldă|caldura|căldură)\b/i,
      /\b(?:fara|fără)\s+(?:caldura|căldură|apa calda|apă caldă|incalzire|încălzire)\b/i
    ],
    guidance: HEAT_LOSS_GUIDANCE
  },
  {
    id: "LEAK_001",
    flag: "active_water_leak",
    urgency: "needs_attention",
    callEmergencyServices: false,
    patterns: [
      /\b(?:leak|leaking|dripping|drip|water (?:is )?(?:coming|running|pouring)|flooding|burst|scurgere|picură|picura|inundatie|inundație)\b/i,
      /\bwater\b[^.!?]{0,30}\b(?:under|from|everywhere|cupboard|floor|ceiling)\b/i
    ],
    guidance: WATER_LEAK_GUIDANCE
  },
  {
    id: "APPLIANCE_001",
    flag: "appliance_fault",
    urgency: "needs_attention",
    callEmergencyServices: false,
    patterns: [
      /\b(?:washing machine|dishwasher|fridge|freezer|oven|tumble dryer|microwave)\b[^.!?]{0,60}\b(?:not|won'?t|stopped|broken|fault|error|leaking|noise|smell|drain|draining|cold|hot|dead)\b/i,
      /\b(?:masina de spalat|mașină de spălat|frigider|cuptor)\b[^.!?]{0,40}\b(?:nu|defect|eroare|scurger)\b/i
    ],
    guidance: APPLIANCE_FAULT_GUIDANCE
  },
  {
    id: "VULNERABLE_001",
    flag: "vulnerable_occupant",
    urgency: "needs_attention",
    callEmergencyServices: false,
    patterns: [
      /\b(?:baby|infant|newborn|toddler|elderly|vulnerable|disabled|wheelchair|oxygen|dialysis|immunocompromised)\b/i,
      /\b(?:bebelus|bebeluș|bebelus|varstnic|vârstnic|bolnav|dizabilit|persoana in varsta|persoană în vârstă)\b/i
    ],
    guidance: []
  },
  {
    id: "BOILER_010",
    flag: "appliance_noise",
    urgency: "needs_attention",
    callEmergencyServices: false,
    patterns: [
      /\b(?:boiler|central heating|centrala|centrală)\b[^.!?]{0,60}\b(?:noise|noisy|loud|humming|banging|rattling|vibrating|kettling|zgomot|bubuit|vibreaz|vibratie|vibrație|fluierat)\b/i,
      /\b(?:noise|noisy|loud|humming|banging|rattling|vibrating|kettling|zgomot|bubuit|vibreaz|fluierat)\b[^.!?]{0,60}\b(?:boiler|central heating|centrala|centrală)\b/i
    ],
    guidance: BOILER_NOISE_GUIDANCE
  }
];

/**
 * A rule that matches inside a negated phrase ("no smell of gas", "fără scurgeri")
 * must not fire. The window is deliberately short: the negation has to sit right
 * before the trigger, otherwise "no heating and my elderly mother" would wrongly
 * suppress the vulnerable-occupant rule.
 */
const NEGATION_WINDOW = 12;
const NEGATION_PATTERN =
  /(?:\b(?:no|not|without|never|denies|denied)\b|\bnu\b|\bfără\b|\bfara\b|\bnicio\b|\bniciun\b|\babsenta\b|\bwant\s+to\s+be\b|\bhope\s+not\s+to\s+be\b)[^.!?;]{0,12}$/i;

type MatchResult = "matched" | "negated" | "none";

function matchPattern(pattern: RegExp, text: string): MatchResult {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const expression = new RegExp(pattern.source, flags);
  let negated = false;
  for (const match of text.matchAll(expression)) {
    const index = match.index ?? 0;
    const before = text.slice(Math.max(0, index - NEGATION_WINDOW), index);
    if (NEGATION_PATTERN.test(before)) {
      negated = true;
      continue;
    }
    return "matched";
  }
  return negated ? "negated" : "none";
}

function matchRule(rule: SafetyRule, text: string): MatchResult {
  let negated = false;
  for (const pattern of rule.patterns) {
    const result = matchPattern(pattern, text);
    if (result === "matched") return "matched";
    if (result === "negated") negated = true;
  }
  return negated ? "negated" : "none";
}

function highestUrgency(current: Urgency, candidate: Urgency): Urgency {
  return URGENCY_RANK[candidate] > URGENCY_RANK[current] ? candidate : current;
}

/**
 * Pure, deterministic triage. The returned urgency is a floor: model output can
 * raise it, never lower it.
 */
export function assessSafety(input: Pick<IssueIntake, "description" | "occupancyNotes">): SafetyAssessment {
  const text = `${input.description} ${input.occupancyNotes ?? ""}`.replace(/\s+/g, " ").trim();

  const flags = new Set<SafetyFlag>();
  const ruleIds: string[] = [];
  const guidance: string[] = [];
  const negatedTriggers: string[] = [];
  let urgency: Urgency = "monitor";
  let callEmergencyServices = false;

  for (const rule of SAFETY_RULES) {
    const result = matchRule(rule, text);
    if (result === "negated") {
      negatedTriggers.push(rule.id);
      continue;
    }
    if (result !== "matched") continue;
    flags.add(rule.flag);
    ruleIds.push(rule.id);
    urgency = highestUrgency(urgency, rule.urgency);
    if (rule.callEmergencyServices) callEmergencyServices = true;
    for (const line of rule.guidance) if (!guidance.includes(line)) guidance.push(line);
  }

  // Combination rule: loss of heat or hot water with a vulnerable occupant.
  if (flags.has("no_heat_or_hot_water") && flags.has("vulnerable_occupant")) {
    urgency = highestUrgency(urgency, "urgent");
    if (!ruleIds.includes("HEAT_002")) ruleIds.push("HEAT_002");
  }

  if (callEmergencyServices) urgency = "emergency";

  return {
    urgency,
    flags: [...flags],
    ruleIds,
    mandatoryGuidance: guidance,
    callEmergencyServices,
    negatedTriggers
  };
}
