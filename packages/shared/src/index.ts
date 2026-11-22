import { z } from "zod";

export const SKILLS = {
  READING: { maxLevel: 3 },
  WRITING: { maxLevel: 2 },
  COUNTING: { maxLevel: 3 },
  INSTRUCTIONS: { maxLevel: 2 },
  ENGAGEMENT: { maxLevel: 1 },
  ROUTINE: { maxLevel: 1 },
} as const;
export const SKILL_CODES = ["READING", "WRITING", "COUNTING", "INSTRUCTIONS", "ENGAGEMENT", "ROUTINE"] as const;
export const skillCodeSchema = z.enum(SKILL_CODES);
export type SkillCode = z.infer<typeof skillCodeSchema>;

export const MASTERY_SESSION_THRESHOLD = 2;

/** Audio clips are matched without trailing punctuation, so "Pilih huruf A." and "Pilih huruf A" share one clip. */
export const normalizeSpeech = (text: string) => text.trim().replace(/\s+/g, " ").replace(/[.!?\s]+$/, "");

export const materialFormatSchema = z.enum(["TEXT", "VISUAL", "AUDIO"]);
export type MaterialFormat = z.infer<typeof materialFormatSchema>;

// HINT and WORKED_EXAMPLE are help with the task. The others are access needs and never reduce independence.
export const supportSchema = z.enum(["HINT", "WORKED_EXAMPLE", "AUDIO", "REPEAT_INSTRUCTION", "VISUAL_CUE"]);
export type Support = z.infer<typeof supportSchema>;
export const TASK_HELP: readonly Support[] = ["HINT", "WORKED_EXAMPLE"];

const nickname = z.string().trim().min(1).max(30);
const note = z.string().trim().max(500);
const password = z.string().min(10).max(128);

export const registerSchema = z.strictObject({
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  password,
  displayName: z.string().trim().min(1).max(60),
});
export const loginSchema = z.strictObject({
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});
export const accountUpdateSchema = z.strictObject({ displayName: z.string().trim().min(1).max(60) });
export const passwordChangeSchema = z.strictObject({ currentPassword: z.string().min(1).max(128), newPassword: password });

export const preferencesSchema = z.strictObject({
  audioEnabled: z.boolean(),
  textSize: z.enum(["NORMAL", "LARGE", "XLARGE"]),
  visualCues: z.boolean(),
  responseMethod: z.enum(["TAP", "CAREGIVER_ASSISTED"]),
  reduceMotion: z.boolean(),
});
export type Preferences = z.infer<typeof preferencesSchema>;
export const DEFAULT_PREFERENCES: Preferences = {
  audioEnabled: true,
  textSize: "LARGE",
  visualCues: true,
  responseMethod: "TAP",
  reduceMotion: false,
};

const targets = z.array(skillCodeSchema).min(1).max(SKILL_CODES.length).transform((codes) => [...new Set(codes)]);

// Strict objects reject extra fields, so a diagnosis cannot be stored through the profile API.
export const childCreateSchema = z.strictObject({
  nickname,
  targets,
  preferences: preferencesSchema,
  initialNotes: note.optional(),
});
export const childUpdateSchema = z.strictObject({ nickname });
export const learningProfileUpdateSchema = z
  .strictObject({ preferences: preferencesSchema.partial().optional(), targets: targets.optional(), initialNotes: note.optional() })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");
export const shareChildSchema = z.strictObject({
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  role: z.enum(["PARENT", "TEACHER"]),
});

export const sessionCreateSchema = z.strictObject({
  type: z.enum(["PRACTICE", "STARTER"]).default("PRACTICE"),
  durationMinutes: z.union([z.literal(5), z.literal(10), z.literal(15)]).default(10),
  skillCodes: z.array(skillCodeSchema).min(1).max(SKILL_CODES.length).optional(),
});

export const answerSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("choice"), value: z.string().max(100) }),
  z.strictObject({ type: z.literal("order"), values: z.array(z.string().max(100)).max(10) }),
  z.strictObject({ type: z.literal("completed") }),
  z.strictObject({ type: z.literal("caregiver_confirmed"), confirmed: z.boolean() }),
]);
export type Answer = z.infer<typeof answerSchema>;

export const resultSubmitSchema = z.strictObject({
  answer: answerSchema,
  supportUsed: z.array(supportSchema).max(5).default([]).transform((items) => [...new Set(items)]),
});

export const masteryReviewSchema = z.strictObject({ decision: z.enum(["ADVANCE", "KEEP_PRACTICING"]) });

export const routineUpdateSchema = z.strictObject({
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7).transform((days) => [...new Set(days)].sort()),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMinutes: z.union([z.literal(5), z.literal(10), z.literal(15)]),
  breakMinutes: z.number().int().min(1).max(10),
  remindersEnabled: z.boolean(),
});

export const noteCreateSchema = z.strictObject({
  body: z.string().trim().min(1).max(1000),
  skillCode: skillCodeSchema.optional(),
  sessionId: z.uuid().optional(),
});

export const answerRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("exact"), value: z.string().min(1) }),
  z.object({ type: z.literal("ordered"), values: z.array(z.string().min(1)).min(2).max(10) }),
  z.object({ type: z.literal("completion") }),
  z.object({ type: z.literal("caregiver_confirmation") }),
]);
export type AnswerRule = z.infer<typeof answerRuleSchema>;

// Internal shapes produced by the ACL. Provider DTOs never cross into the core.
export const materialSchema = z.object({
  materialId: z.string().min(1).max(100),
  version: z.string().min(1).max(30),
  skillCode: skillCodeSchema,
  level: z.number().int().min(1).max(10),
  format: materialFormatSchema,
  mediaUrl: z.string().min(1).max(20000),
  title: z.string().min(1).max(120),
});
export type Material = z.infer<typeof materialSchema>;

export const activitySchema = z.object({
  activityId: z.string().min(1).max(100),
  version: z.string().min(1).max(30),
  skillCode: skillCodeSchema,
  level: z.number().int().min(1).max(10),
  title: z.string().min(1).max(120),
  steps: z.array(z.object({ instruction: z.string().min(1).max(300), visual: z.string().max(20).optional() })).min(1).max(5),
  response: z.object({
    kind: z.enum(["choice", "order", "trace", "paper", "done"]),
    options: z.array(z.string().min(1).max(100)).max(10).optional(),
    target: z.string().max(10).optional(),
  }),
  example: z.string().max(300).optional(),
  hint: z.string().max(300).optional(),
  answerRule: answerRuleSchema,
});
export type Activity = z.infer<typeof activitySchema>;
export type PublicActivity = Omit<Activity, "answerRule">;

export const catalogResponseSchema = <T extends z.ZodType>(item: T) =>
  z.object({ data: z.array(item), source: z.enum(["live", "cache"]) });

export const catalogQuerySchema = z.strictObject({
  skill_code: skillCodeSchema,
  level: z.coerce.number().int().min(1).max(10),
  format: materialFormatSchema.optional(),
});
