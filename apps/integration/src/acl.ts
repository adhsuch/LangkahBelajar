import { activitySchema, answerRuleSchema, materialFormatSchema, materialSchema, skillCodeSchema, type Activity, type Material } from "@langkahbelajar/shared";
import { z } from "zod";
import { ProviderError } from "./provider-client";

const version = z.union([z.string(), z.number()]).transform(String);

const materialDto = z.object({
  material_id: z.string(),
  version,
  skill_code: skillCodeSchema,
  level: z.number().int(),
  format: materialFormatSchema,
  media_url: z.string(),
  title: z.string().optional(),
});

const activityDto = z.object({
  activity_id: z.string(),
  version,
  skill_code: skillCodeSchema,
  level: z.number().int().optional(),
  title: z.string().optional(),
  steps: z.array(z.object({ instruction: z.string(), visual: z.string().optional(), options: z.array(z.string()).optional(), target: z.string().optional() })).min(1),
  example: z.string().optional(),
  hint: z.string().optional(),
  answer_rule: answerRuleSchema,
});

// Only https and inline image or text media may reach a child's screen.
const SAFE_MEDIA = /^(https:\/\/|data:image\/(svg\+xml|png|jpeg|webp)[,;]|data:text\/plain[,;])/i;

export function toMaterial(dto: z.infer<typeof materialDto>): Material {
  if (!SAFE_MEDIA.test(dto.media_url)) throw new Error("Unsafe media URL");
  return materialSchema.parse({
    materialId: dto.material_id,
    version: dto.version,
    skillCode: dto.skill_code,
    level: dto.level,
    format: dto.format,
    mediaUrl: dto.media_url,
    title: dto.title ?? `${dto.skill_code} ${dto.level}`,
  });
}

function responseFor(dto: z.infer<typeof activityDto>): Activity["response"] {
  const options = dto.steps.find((step) => step.options)?.options;
  const target = dto.steps.find((step) => step.target)?.target;
  switch (dto.answer_rule.type) {
    case "exact":
      if (!options?.includes(dto.answer_rule.value)) throw new Error("Answer is not among the options");
      return { kind: "choice", options };
    case "ordered":
      if (!options || [...options].sort().join("\n") !== [...dto.answer_rule.values].sort().join("\n")) throw new Error("Order options do not match the rule");
      return { kind: "order", options };
    case "completion":
      return target ? { kind: "trace", target } : { kind: "done" };
    case "caregiver_confirmation":
      return { kind: "paper", ...(target ? { target } : {}) };
  }
}

export function toActivity(dto: z.infer<typeof activityDto>, requestedLevel: number): Activity {
  return activitySchema.parse({
    activityId: dto.activity_id,
    version: dto.version,
    skillCode: dto.skill_code,
    level: dto.level ?? requestedLevel,
    title: dto.title ?? dto.activity_id,
    steps: dto.steps.map(({ instruction, visual }) => ({ instruction, ...(visual ? { visual } : {}) })),
    response: responseFor(dto),
    ...(dto.example ? { example: dto.example } : {}),
    ...(dto.hint ? { hint: dto.hint } : {}),
    answerRule: dto.answer_rule,
  });
}

const envelope = z.object({ data: z.array(z.unknown()) });

/** One bad record is dropped and counted. It must not hide the provider's valid records. */
function translateAll<D extends z.ZodType, T>(payload: unknown, dto: D, translate: (value: z.output<D>) => T, onRejected: (count: number) => void) {
  const parsed = envelope.safeParse(payload);
  if (!parsed.success) throw new ProviderError("INVALID_RESPONSE");
  const items: T[] = [];
  for (const raw of parsed.data.data) {
    try {
      items.push(translate(dto.parse(raw)));
    } catch {
      // Counted below.
    }
  }
  const rejected = parsed.data.data.length - items.length;
  if (rejected > 0) onRejected(rejected);
  return items;
}

export const translateMaterials = (payload: unknown, onRejected: (count: number) => void = () => undefined) =>
  translateAll(payload, materialDto, toMaterial, onRejected);

export const translateActivities = (payload: unknown, requestedLevel: number, onRejected: (count: number) => void = () => undefined) =>
  translateAll(payload, activityDto, (dto) => toActivity(dto, requestedLevel), onRejected);
