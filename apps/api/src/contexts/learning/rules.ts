import { MASTERY_SESSION_THRESHOLD, TASK_HELP, type Activity, type Answer, type AnswerRule, type Material, type SkillCode, type Support } from "@langkahbelajar/shared";
import { isDeepStrictEqual } from "node:util";

export function evaluateAnswer(rule: AnswerRule, answer: Answer) {
  switch (rule.type) {
    case "exact":
      return answer.type === "choice" && answer.value === rule.value;
    case "ordered":
      return answer.type === "order" && isDeepStrictEqual(answer.values, rule.values);
    case "completion":
      return answer.type === "completed";
    case "caregiver_confirmation":
      return answer.type === "caregiver_confirmed" && answer.confirmed;
  }
}

/** Independent success: correct on the first attempt without a hint or worked example. Access supports do not count against it. */
export const isIndependent = (isCorrect: boolean, attemptNo: number, supportUsed: Support[]) =>
  isCorrect && attemptNo === 1 && !supportUsed.some((support) => TASK_HELP.includes(support));

export type MasteryStatus = "PRACTICING" | "NEXT_STAGE_OFFERED" | "FINAL_STAGE_REACHED";

/** Planning threshold from the paper, reviewable by the caregiver. It is not a validated developmental standard. */
export function decideMastery(input: { level: number; maxLevel: number; evidenceSessions: number; dismissedAtCount: number }): MasteryStatus {
  if (input.evidenceSessions < MASTERY_SESSION_THRESHOLD) return "PRACTICING";
  if (input.level >= input.maxLevel) return "FINAL_STAGE_REACHED";
  return input.evidenceSessions > input.dismissedAtCount ? "NEXT_STAGE_OFFERED" : "PRACTICING";
}

export type AdaptationReason = "REPEAT_NEEDS_SUPPORT" | "NEW_ACTIVITY" | "REINFORCE" | "STARTER";

export interface ActivityHistory {
  attempts: number;
  independent: number;
}

export interface SkillPlan {
  skillCode: SkillCode;
  level: number;
  activities: Activity[];
  material: Material | null;
}

export interface ComposedStep {
  kind: "START" | "PRACTICE" | "BREAK" | "FINISH";
  status: "PENDING" | "POSTPONED";
  skillCode?: SkillCode;
  level?: number;
  activity?: Activity;
  material?: Material | null;
  adaptationReason?: AdaptationReason;
}

const PRACTICE_COUNT: Record<number, number> = { 5: 2, 10: 4, 15: 6 };

function rankActivities(activities: Activity[], history: Map<string, ActivityHistory>, starter: boolean) {
  const reasonFor = (activity: Activity): AdaptationReason => {
    if (starter) return "STARTER";
    const seen = history.get(activity.activityId);
    if (!seen?.attempts) return "NEW_ACTIVITY";
    return seen.independent > 0 ? "REINFORCE" : "REPEAT_NEEDS_SUPPORT";
  };
  const priority: Record<AdaptationReason, number> = { REPEAT_NEEDS_SUPPORT: 0, NEW_ACTIVITY: 1, STARTER: 1, REINFORCE: 2 };
  return activities
    .map((activity) => ({ activity, reason: reasonFor(activity), attempts: history.get(activity.activityId)?.attempts ?? 0 }))
    .sort((a, b) => priority[a.reason] - priority[b.reason] || a.attempts - b.attempts || a.activity.activityId.localeCompare(b.activity.activityId));
}

/** Rule-based composition following the fixed start, practice, break, finish pattern. */
export function composeSession(input: { type: "PRACTICE" | "STARTER"; durationMinutes: number; skills: SkillPlan[]; history: Map<string, ActivityHistory> }): ComposedStep[] {
  const starter = input.type === "STARTER";
  const limit = starter ? input.skills.length : (PRACTICE_COUNT[input.durationMinutes] ?? 4);
  const queues = input.skills.map((skill) => ({ skill, ranked: rankActivities(skill.activities, input.history, starter) }));
  const practice: ComposedStep[] = [];

  while (practice.length < limit && queues.some((queue) => queue.ranked.length > 0)) {
    for (const { skill, ranked } of queues) {
      const next = ranked.shift();
      if (!next || practice.length >= limit) continue;
      practice.push({ kind: "PRACTICE", status: "PENDING", skillCode: skill.skillCode, level: skill.level, activity: next.activity, material: skill.material, adaptationReason: next.reason });
      if (starter) ranked.length = 0;
    }
  }

  const postponed = input.skills
    .filter((skill) => skill.activities.length === 0)
    .map((skill): ComposedStep => ({ kind: "PRACTICE", status: "POSTPONED", skillCode: skill.skillCode, level: skill.level, material: skill.material }));
  const middle = Math.ceil(practice.length / 2);
  return [
    { kind: "START", status: "PENDING" },
    ...practice.slice(0, middle),
    { kind: "BREAK", status: "PENDING" },
    ...practice.slice(middle),
    ...postponed,
    { kind: "FINISH", status: "PENDING" },
  ];
}
