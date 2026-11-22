import type { Activity } from "@langkahbelajar/shared";
import { describe, expect, it } from "vitest";
import { composeSession, decideMastery, evaluateAnswer, isIndependent } from "../src/contexts/learning/rules";

const activity = (activityId: string, skillCode: Activity["skillCode"] = "READING"): Activity => ({
  activityId, version: "1", skillCode, level: 1, title: activityId,
  steps: [{ instruction: "x" }], response: { kind: "done" }, answerRule: { type: "completion" },
});

describe("evaluateAnswer", () => {
  it("checks exact and ordered answers", () => {
    expect(evaluateAnswer({ type: "exact", value: "A" }, { type: "choice", value: "A" })).toBe(true);
    expect(evaluateAnswer({ type: "exact", value: "A" }, { type: "choice", value: "B" })).toBe(false);
    expect(evaluateAnswer({ type: "ordered", values: ["1", "2"] }, { type: "order", values: ["2", "1"] })).toBe(false);
  });

  it("rejects an answer of the wrong type", () => {
    expect(evaluateAnswer({ type: "exact", value: "A" }, { type: "completed" })).toBe(false);
  });

  it("requires a caregiver yes for paper copying", () => {
    expect(evaluateAnswer({ type: "caregiver_confirmation" }, { type: "caregiver_confirmed", confirmed: false })).toBe(false);
    expect(evaluateAnswer({ type: "caregiver_confirmation" }, { type: "caregiver_confirmed", confirmed: true })).toBe(true);
  });
});

describe("isIndependent", () => {
  it("does not penalize access supports", () => expect(isIndependent(true, 1, ["AUDIO", "VISUAL_CUE", "REPEAT_INSTRUCTION"])).toBe(true));
  it("excludes hints and examples", () => {
    expect(isIndependent(true, 1, ["HINT"])).toBe(false);
    expect(isIndependent(true, 1, ["WORKED_EXAMPLE"])).toBe(false);
  });
  it("excludes later attempts", () => expect(isIndependent(true, 2, [])).toBe(false));
});

describe("decideMastery", () => {
  const base = { level: 1, maxLevel: 3, dismissedAtCount: 0 };
  it("needs two sessions", () => {
    expect(decideMastery({ ...base, evidenceSessions: 1 })).toBe("PRACTICING");
    expect(decideMastery({ ...base, evidenceSessions: 2 })).toBe("NEXT_STAGE_OFFERED");
  });
  it("offers again only after new evidence", () => {
    expect(decideMastery({ ...base, evidenceSessions: 2, dismissedAtCount: 2 })).toBe("PRACTICING");
    expect(decideMastery({ ...base, evidenceSessions: 3, dismissedAtCount: 2 })).toBe("NEXT_STAGE_OFFERED");
  });
  it("has no next stage at the top level", () => expect(decideMastery({ ...base, level: 3, evidenceSessions: 2 })).toBe("FINAL_STAGE_REACHED"));
});

describe("composeSession", () => {
  const kinds = (steps: ReturnType<typeof composeSession>) => steps.map((step) => step.kind);

  it("follows start, practice, break, finish", () => {
    const steps = composeSession({ type: "PRACTICE", durationMinutes: 5, history: new Map(), skills: [{ skillCode: "READING", level: 1, material: null, activities: [activity("a"), activity("b"), activity("c")] }] });
    expect(kinds(steps)).toEqual(["START", "PRACTICE", "BREAK", "PRACTICE", "FINISH"]);
  });

  it("repeats activities that still needed support first", () => {
    const history = new Map([["b", { attempts: 2, independent: 0 }], ["a", { attempts: 1, independent: 1 }]]);
    const steps = composeSession({ type: "PRACTICE", durationMinutes: 5, history, skills: [{ skillCode: "READING", level: 1, material: null, activities: [activity("a"), activity("b"), activity("c")] }] });
    const practice = steps.filter((step) => step.kind === "PRACTICE");
    expect(practice.map((step) => step.activity?.activityId)).toEqual(["b", "c"]);
    expect(practice[0]?.adaptationReason).toBe("REPEAT_NEEDS_SUPPORT");
  });

  it("never repeats an activity within one session", () => {
    const steps = composeSession({ type: "PRACTICE", durationMinutes: 15, history: new Map(), skills: [{ skillCode: "READING", level: 1, material: null, activities: [activity("a"), activity("b")] }] });
    expect(steps.filter((step) => step.kind === "PRACTICE")).toHaveLength(2);
  });

  it("alternates between target skills", () => {
    const steps = composeSession({
      type: "PRACTICE", durationMinutes: 10, history: new Map(),
      skills: [
        { skillCode: "READING", level: 1, material: null, activities: [activity("r1"), activity("r2")] },
        { skillCode: "COUNTING", level: 1, material: null, activities: [activity("c1", "COUNTING"), activity("c2", "COUNTING")] },
      ],
    });
    expect(steps.filter((step) => step.kind === "PRACTICE").map((step) => step.skillCode)).toEqual(["READING", "COUNTING", "READING", "COUNTING"]);
  });

  it("postpones a skill with no available activity", () => {
    const steps = composeSession({
      type: "PRACTICE", durationMinutes: 5, history: new Map(),
      skills: [
        { skillCode: "READING", level: 1, material: null, activities: [activity("a")] },
        { skillCode: "COUNTING", level: 1, material: null, activities: [] },
      ],
    });
    expect(steps.find((step) => step.skillCode === "COUNTING")?.status).toBe("POSTPONED");
  });

  it("uses one activity per skill for a starter session", () => {
    const steps = composeSession({ type: "STARTER", durationMinutes: 10, history: new Map(), skills: [{ skillCode: "READING", level: 1, material: null, activities: [activity("a"), activity("b")] }] });
    expect(steps.filter((step) => step.kind === "PRACTICE")).toHaveLength(1);
  });
});
