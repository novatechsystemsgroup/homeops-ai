import { describe, expect, it } from "vitest";
import { buildPlanUserPrompt, extractJsonObject } from "./plan";
import { boilerIntake } from "@homeops/test-fixtures";
import { assessSafety } from "../safety/rules";

const FENCE = String.fromCharCode(96).repeat(3);

describe("extractJsonObject", () => {
  it("parses a plain JSON object", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses JSON wrapped in a code fence", () => {
    expect(extractJsonObject(`${FENCE}json\n{"a":1}\n${FENCE}`)).toEqual({ a: 1 });
  });

  it("ignores prose before and after the object", () => {
    expect(extractJsonObject('Here is the plan:\n{"a":1}\nLet me know if you need changes.')).toEqual({ a: 1 });
  });

  it("returns the first balanced object when the model appends a second one", () => {
    expect(extractJsonObject('{"a":1}\n{"b":2}')).toEqual({ a: 1 });
  });

  it("tolerates a trailing comma", () => {
    expect(extractJsonObject('{"a":1,}')).toEqual({ a: 1 });
  });

  it("does not stop at braces inside strings", () => {
    expect(extractJsonObject('{"title":"book a { boiler } service","n":2}')).toEqual({ title: "book a { boiler } service", n: 2 });
  });

  it("throws a descriptive error for an unterminated object", () => {
    expect(() => extractJsonObject('{"a":1')).toThrowError(/unterminated/i);
  });

  it("throws when there is no object at all", () => {
    expect(() => extractJsonObject("I cannot help with that.")).toThrowError(/did not contain a JSON object/i);
  });
});

describe("buildPlanUserPrompt", () => {
  const prompt = buildPlanUserPrompt({
    intake: boilerIntake(),
    household: null,
    safety: assessSafety({ description: "The boiler is humming loudly.", occupancyNotes: null }),
    issueType: "boiler",
    today: "2026-10-07T08:00:00.000Z",
    repairHint: null
  });

  it("carries the report, the deterministic triage and the JSON example", () => {
    expect(prompt).toContain("The boiler is making a loud humming noise");
    expect(prompt).toContain("Application safety triage: urgency=");
    expect(prompt).toContain("\"issueSummary\"");
    expect(prompt).toContain("1 to 5 actions");
  });

  it("tells the model to use the example shape without copying it", () => {
    expect(prompt).toContain("never copy its wording");
  });
});
