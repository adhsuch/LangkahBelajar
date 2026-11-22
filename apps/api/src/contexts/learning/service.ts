import {
  MASTERY_SESSION_THRESHOLD,
  SKILLS,
  TASK_HELP,
  activitySchema,
  type Answer,
  type MaterialFormat,
  type Preferences,
  type SkillCode,
  type Support,
} from "@langkahbelajar/shared";
import type { Prisma, SessionStatus } from "@prisma/client";
import { isDeepStrictEqual } from "node:util";
import { AppError, notFound } from "../../lib/errors";
import { isUniqueViolation, prisma, type Tx } from "../../lib/prisma";
import { getActivities, getMaterials } from "../../integrations/catalog";
import { getProfileSnapshot } from "../profile/service";
import { publishSessionCompleted, type SessionCompleted } from "./events";
import { composeSession, decideMastery, evaluateAnswer, isIndependent, type ActivityHistory, type SkillPlan } from "./rules";

const BLOCKING_STATUSES: SessionStatus[] = ["PLANNED", "IN_PROGRESS", "PAUSED"];
const stepsInclude = { steps: { orderBy: { position: "asc" }, include: { _count: { select: { results: true } } } } } as const;
type SessionWithSteps = Prisma.LearningSessionGetPayload<{ include: typeof stepsInclude }>;

const lockChild = (tx: Tx, childId: string) => tx.$queryRaw`SELECT id FROM child_profiles WHERE id = ${childId}::uuid FOR UPDATE`;
const lockSession = (tx: Tx, sessionId: string) => tx.$queryRaw`SELECT id FROM learning_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`;

async function assertNoBlockingSession(tx: Tx, childId: string, exceptId?: string) {
  const active = await tx.learningSession.findFirst({ where: { childId, status: { in: BLOCKING_STATUSES }, ...(exceptId ? { id: { not: exceptId } } : {}) } });
  if (active) throw new AppError(409, "SESSION_ALREADY_ACTIVE", `Session ${active.id} is still active`);
}

const preferredFormat = (preferences: Preferences): MaterialFormat =>
  preferences.audioEnabled ? "AUDIO" : preferences.visualCues ? "VISUAL" : "TEXT";

/** Answer rules stay on the server, so the client cannot read the correct answer. */
export function sessionView(session: SessionWithSteps) {
  const current = session.steps.find((step) => step.status === "PENDING");
  return {
    id: session.id,
    childId: session.childId,
    type: session.type,
    status: session.status,
    durationMinutes: session.durationMinutes,
    profileSnapshot: session.profileSnapshot,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    currentStepId: current?.id ?? null,
    steps: session.steps.map((step) => {
      const parsed = step.activity ? activitySchema.parse(step.activity) : null;
      const { answerRule: _answerRule, ...activity } = parsed ?? { answerRule: null };
      return {
        id: step.id,
        position: step.position,
        kind: step.kind,
        status: step.status,
        skillCode: step.skillCode,
        level: step.level,
        attempts: step._count.results,
        adaptationReason: step.adaptationReason,
        activity: parsed ? activity : null,
        material: step.material,
      };
    }),
  };
}

const loadSession = (client: Tx, id: string) => client.learningSession.findUnique({ where: { id }, include: stepsInclude });

export async function getSessionOrThrow(id: string) {
  const session = await loadSession(prisma, id);
  if (!session) throw notFound();
  return session;
}

export async function createSession(childId: string, input: { type: "PRACTICE" | "STARTER"; durationMinutes: 5 | 10 | 15; skillCodes?: SkillCode[] }) {
  await assertNoBlockingSession(prisma, childId);
  const snapshot = await getProfileSnapshot(childId);
  const skillCodes = input.skillCodes ?? snapshot.targets;
  const mastery = await prisma.skillMastery.findMany({ where: { childId, skillCode: { in: skillCodes } } });
  const levelOf = (skillCode: SkillCode) => (input.type === "STARTER" ? 1 : (mastery.find((row) => row.skillCode === skillCode)?.currentLevel ?? 1));
  const format = preferredFormat(snapshot.preferences);

  // Catalog calls run before the transaction, so a slow provider never holds a database lock.
  const skills: SkillPlan[] = await Promise.all(
    skillCodes.map(async (skillCode) => {
      const level = levelOf(skillCode);
      const [activities, materials] = await Promise.all([getActivities(skillCode, level), getMaterials(skillCode, level, format)]);
      return { skillCode, level, activities: activities.items, material: materials.items[0] ?? null };
    }),
  );
  if (skills.every((skill) => skill.activities.length === 0)) {
    throw new AppError(503, "ACTIVITIES_UNAVAILABLE", "Activities are temporarily unavailable. Saved progress is safe.");
  }

  const past = await prisma.exerciseResult.findMany({ where: { childId, skillCode: { in: skillCodes } }, select: { activityId: true, independent: true } });
  const history = new Map<string, ActivityHistory>();
  for (const row of past) {
    const entry = history.get(row.activityId) ?? { attempts: 0, independent: 0 };
    entry.attempts += 1;
    if (row.independent) entry.independent += 1;
    history.set(row.activityId, entry);
  }

  const steps = composeSession({ type: input.type, durationMinutes: input.durationMinutes, skills, history });
  const sessionId = await prisma.$transaction(async (tx) => {
    await lockChild(tx, childId);
    await assertNoBlockingSession(tx, childId);
    const session = await tx.learningSession.create({
      data: {
        childId,
        type: input.type,
        durationMinutes: input.durationMinutes,
        profileSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        steps: {
          create: steps.map((step, position) => ({
            position,
            kind: step.kind,
            status: step.status,
            skillCode: step.skillCode,
            level: step.level,
            activityId: step.activity?.activityId,
            activityVersion: step.activity?.version,
            activity: step.activity as Prisma.InputJsonValue | undefined,
            material: (step.material ?? undefined) as Prisma.InputJsonValue | undefined,
            adaptationReason: step.adaptationReason,
          })),
        },
      },
    });
    return session.id;
  });
  return getSessionOrThrow(sessionId);
}

export async function listResumableSession(childId: string) {
  return prisma.learningSession.findFirst({
    where: { childId, status: { in: [...BLOCKING_STATUSES, "STOPPED"] } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, status: true, type: true },
  });
}

const TRANSITIONS: Record<"start" | "pause" | "resume" | "stop", { from: SessionStatus[]; to: SessionStatus }> = {
  start: { from: ["PLANNED"], to: "IN_PROGRESS" },
  pause: { from: ["IN_PROGRESS"], to: "PAUSED" },
  resume: { from: ["PAUSED", "STOPPED"], to: "IN_PROGRESS" },
  stop: { from: ["PLANNED", "IN_PROGRESS", "PAUSED"], to: "STOPPED" },
};

/** Pausing and stopping only save state. They never touch results or mastery. */
export async function transitionSession(id: string, action: keyof typeof TRANSITIONS) {
  const { from, to } = TRANSITIONS[action];
  await prisma.$transaction(async (tx) => {
    const childId = (await tx.learningSession.findUniqueOrThrow({ where: { id }, select: { childId: true } })).childId;
    await lockChild(tx, childId);
    await lockSession(tx, id);
    const session = await tx.learningSession.findUniqueOrThrow({ where: { id } });
    if (session.status === to) return;
    if (!from.includes(session.status)) throw new AppError(409, "INVALID_SESSION_STATE", `Cannot ${action} a ${session.status} session`);
    if (action === "resume") await assertNoBlockingSession(tx, childId, id);
    const now = new Date();
    await tx.learningSession.update({
      where: { id },
      data: {
        status: to,
        ...(action === "start" ? { startedAt: now } : {}),
        ...(action === "pause" ? { pausedAt: now, pauseCount: { increment: 1 } } : {}),
        ...(action === "stop" ? { stoppedAt: now } : {}),
        ...(action === "resume" ? { startedAt: session.startedAt ?? now, pausedAt: null, stoppedAt: null } : {}),
      },
    });
  });
  return getSessionOrThrow(id);
}

async function evidenceSessions(tx: Tx, childId: string, skillCode: string, level: number) {
  const rows = await tx.exerciseResult.findMany({
    where: { childId, skillCode, level, independent: true, countsTowardMastery: true },
    distinct: ["sessionId"],
    select: { sessionId: true },
  });
  return rows.length;
}

async function refreshMastery(tx: Tx, childId: string, skillCode: SkillCode) {
  const row = await tx.skillMastery.upsert({ where: { childId_skillCode: { childId, skillCode } }, create: { childId, skillCode }, update: {} });
  const evidence = await evidenceSessions(tx, childId, skillCode, row.currentLevel);
  const status = decideMastery({ level: row.currentLevel, maxLevel: SKILLS[skillCode].maxLevel, evidenceSessions: evidence, dismissedAtCount: row.dismissedAtCount });
  if (status !== row.status) await tx.skillMastery.update({ where: { childId_skillCode: { childId, skillCode } }, data: { status } });
}

export async function submitResult(sessionId: string, stepId: string, idempotencyKey: string, input: { answer: Answer; supportUsed: Support[] }) {
  try {
    return await prisma.$transaction(async (tx) => {
      await lockSession(tx, sessionId);
      const existing = await tx.exerciseResult.findUnique({ where: { idempotencyKey } });
      if (existing) {
        const samePayload = existing.stepId === stepId && isDeepStrictEqual(existing.answer, input.answer) && isDeepStrictEqual([...existing.supportUsed].sort(), [...input.supportUsed].sort());
        if (!samePayload) throw new AppError(409, "IDEMPOTENCY_CONFLICT", "This key was already used for a different result");
        return { result: resultView(existing), replayed: true };
      }

      const session = await loadSession(tx, sessionId);
      if (!session) throw notFound();
      if (session.status !== "IN_PROGRESS") throw new AppError(409, "SESSION_NOT_ACTIVE", "The session is not in progress");
      const step = session.steps.find((candidate) => candidate.id === stepId);
      if (!step) throw notFound();
      if (session.steps.find((candidate) => candidate.status === "PENDING")?.id !== stepId) throw new AppError(409, "STEP_NOT_CURRENT", "This is not the current step");
      if (step.kind !== "PRACTICE" || !step.activity || !step.skillCode || !step.level) throw new AppError(422, "STEP_NOT_ANSWERABLE", "This step does not accept answers");

      const activity = activitySchema.parse(step.activity);
      const isCorrect = evaluateAnswer(activity.answerRule, input.answer);
      const attemptNo = step._count.results + 1;
      const independent = isIndependent(isCorrect, attemptNo, input.supportUsed);
      const countsTowardMastery = session.type === "PRACTICE";
      const result = await tx.exerciseResult.create({
        data: {
          idempotencyKey,
          sessionId,
          stepId,
          childId: session.childId,
          skillCode: step.skillCode,
          level: step.level,
          activityId: activity.activityId,
          activityVersion: activity.version,
          attemptNo,
          answer: input.answer,
          isCorrect,
          supportUsed: input.supportUsed,
          independent,
          countsTowardMastery,
        },
      });
      if (isCorrect) await tx.sessionStep.update({ where: { id: stepId }, data: { status: "COMPLETED" } });
      if (independent && countsTowardMastery) await refreshMastery(tx, session.childId, step.skillCode as SkillCode);
      return { result: resultView(result), replayed: false };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError(409, "IDEMPOTENCY_CONFLICT", "This key was already used for a different result");
    throw error;
  }
}

function resultView(result: { id: string; stepId: string; attemptNo: number; isCorrect: boolean; independent: boolean; supportUsed: string[] }) {
  return { id: result.id, stepId: result.stepId, attemptNo: result.attemptNo, isCorrect: result.isCorrect, independent: result.independent, supportUsed: result.supportUsed };
}

async function buildCompletedEvent(tx: Tx, session: SessionWithSteps, completedAt: Date): Promise<SessionCompleted> {
  const results = await tx.exerciseResult.findMany({ where: { sessionId: session.id } });
  const bySkill = new Map<SkillCode, SessionCompleted["skills"][number]>();
  const entry = (skillCode: SkillCode) => {
    const existing = bySkill.get(skillCode) ?? { skillCode, completed: 0, skipped: 0, postponed: 0, independent: 0, withTaskHelp: 0 };
    bySkill.set(skillCode, existing);
    return existing;
  };
  for (const step of session.steps) {
    if (step.kind !== "PRACTICE" || !step.skillCode) continue;
    const skill = entry(step.skillCode as SkillCode);
    // The finishing transaction has not committed yet, but practice steps are already resolved.
    if (step.status === "COMPLETED") skill.completed += 1;
    if (step.status === "SKIPPED") skill.skipped += 1;
    if (step.status === "POSTPONED") skill.postponed += 1;
  }
  for (const result of results) {
    const skill = entry(result.skillCode as SkillCode);
    if (result.independent) skill.independent += 1;
    if (result.supportUsed.some((support) => TASK_HELP.includes(support as Support))) skill.withTaskHelp += 1;
  }
  return { sessionId: session.id, childId: session.childId, completedAt: completedAt.toISOString(), skills: [...bySkill.values()] };
}

/** Moves past the current step. A practice step left unanswered is SKIPPED, which is not a failure. */
export async function advanceStep(sessionId: string, stepId: string) {
  await prisma.$transaction(async (tx) => {
    await lockSession(tx, sessionId);
    const session = await loadSession(tx, sessionId);
    if (!session) throw notFound();
    const step = session.steps.find((candidate) => candidate.id === stepId);
    if (!step) throw notFound();
    if (step.status !== "PENDING") return;
    if (session.status !== "IN_PROGRESS") throw new AppError(409, "SESSION_NOT_ACTIVE", "The session is not in progress");
    if (session.steps.find((candidate) => candidate.status === "PENDING")?.id !== stepId) throw new AppError(409, "STEP_NOT_CURRENT", "This is not the current step");

    await tx.sessionStep.update({ where: { id: stepId }, data: { status: step.kind === "PRACTICE" ? "SKIPPED" : "COMPLETED" } });
    if (step.kind === "FINISH") {
      const completedAt = new Date();
      await tx.learningSession.update({ where: { id: sessionId }, data: { status: "COMPLETED", completedAt } });
      const finished = await loadSession(tx, sessionId);
      if (finished) await publishSessionCompleted(await buildCompletedEvent(tx, finished, completedAt), tx);
    }
  });
  return getSessionOrThrow(sessionId);
}

export async function getProgress(childId: string) {
  const [snapshot, rows] = await Promise.all([getProfileSnapshot(childId), prisma.skillMastery.findMany({ where: { childId } })]);
  const codes = [...new Set([...snapshot.targets, ...rows.map((row) => row.skillCode as SkillCode)])];
  return Promise.all(codes.map(async (skillCode) => {
    const row = rows.find((candidate) => candidate.skillCode === skillCode);
    const currentLevel = row?.currentLevel ?? 1;
    return {
      skillCode,
      isTarget: snapshot.targets.includes(skillCode),
      currentLevel,
      maxLevel: SKILLS[skillCode].maxLevel,
      status: row?.status ?? "PRACTICING",
      independentSessions: await evidenceSessions(prisma, childId, skillCode, currentLevel),
      threshold: MASTERY_SESSION_THRESHOLD,
      reviewedAt: row?.reviewedAt ?? null,
    };
  }));
}

export async function getSkillHistory(childId: string, skillCode: SkillCode) {
  const results = await prisma.exerciseResult.findMany({
    where: { childId, skillCode },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { step: { select: { activity: true, status: true } } },
  });
  return results.map((result) => ({
    id: result.id,
    sessionId: result.sessionId,
    createdAt: result.createdAt,
    level: result.level,
    title: activitySchema.parse(result.step.activity).title,
    answer: result.answer,
    isCorrect: result.isCorrect,
    independent: result.independent,
    supportUsed: result.supportUsed,
    stepStatus: result.step.status,
    countsTowardMastery: result.countsTowardMastery,
  }));
}

export async function reviewMastery(childId: string, skillCode: SkillCode, decision: "ADVANCE" | "KEEP_PRACTICING") {
  await prisma.$transaction(async (tx) => {
    await lockChild(tx, childId);
    const row = await tx.skillMastery.findUnique({ where: { childId_skillCode: { childId, skillCode } } });
    if (row?.status !== "NEXT_STAGE_OFFERED") throw new AppError(409, "NO_PENDING_RECOMMENDATION", "There is no next-stage recommendation to review");
    const reviewedAt = new Date();
    const data =
      decision === "ADVANCE"
        ? { currentLevel: row.currentLevel + 1, status: "PRACTICING" as const, dismissedAtCount: 0, reviewedAt }
        : { status: "PRACTICING" as const, dismissedAtCount: await evidenceSessions(tx, childId, skillCode, row.currentLevel), reviewedAt };
    await tx.skillMastery.update({ where: { childId_skillCode: { childId, skillCode } }, data });
  });
  return getProgress(childId);
}
