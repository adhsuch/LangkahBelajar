import { SKILLS, SKILL_CODES, masteryReviewSchema, resultSubmitSchema, sessionCreateSchema, skillCodeSchema } from "@langkahbelajar/shared";
import { Router, type Request } from "express";
import { z } from "zod";
import { AppError, notFound, parseId } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { assertChildAccess, authorizedChildId, currentUser, requireApiScope, requireAuth } from "../identity/access";
import { advanceStep, createSession, getProgress, getSessionOrThrow, getSkillHistory, listResumableSession, reviewMastery, sessionView, submitResult, transitionSession } from "./service";

export const learningRouter = Router();

const skillList = () => SKILL_CODES.map((code) => ({ code, maxLevel: SKILLS[code].maxLevel }));

learningRouter.get("/skills", requireAuth, (_req, res) => void res.json({ skills: skillList() }));

// Cross-group surface: catalog metadata only, never child data or progress.
learningRouter.get("/partner/skills", requireApiScope("skills:read"), (_req, res) => void res.json({ skills: skillList() }));

function skillParam(req: Request) {
  const parsed = skillCodeSchema.safeParse(req.params.skillCode);
  if (!parsed.success) throw notFound();
  return parsed.data;
}

async function authorizedSession(req: Request) {
  const id = parseId(req.params.id);
  const session = await prisma.learningSession.findUnique({ where: { id }, select: { childId: true } });
  if (!session) throw notFound();
  await assertChildAccess(currentUser(req).id, session.childId);
  return id;
}

learningRouter.use(["/children", "/sessions"], requireAuth);

learningRouter.get("/children/:id/skills", async (req, res) => {
  res.json({ skills: await getProgress(await authorizedChildId(req)) });
});

learningRouter.post("/children/:id/sessions", async (req, res) => {
  const childId = await authorizedChildId(req);
  const session = await createSession(childId, sessionCreateSchema.parse(req.body ?? {}));
  res.status(201).json({ session: sessionView(session) });
});

learningRouter.get("/children/:id/sessions/resumable", async (req, res) => {
  res.json({ session: await listResumableSession(await authorizedChildId(req)) });
});

learningRouter.get("/sessions/:id", async (req, res) => {
  res.json({ session: sessionView(await getSessionOrThrow(await authorizedSession(req))) });
});

for (const action of ["start", "pause", "resume", "stop"] as const) {
  learningRouter.patch(`/sessions/:id/${action}`, async (req, res) => {
    res.json({ session: sessionView(await transitionSession(await authorizedSession(req), action)) });
  });
}

const idempotencyKey = z.string().trim().min(8).max(128);

learningRouter.post("/sessions/:id/steps/:stepId/results", async (req, res) => {
  const id = await authorizedSession(req);
  const key = idempotencyKey.safeParse(req.get("idempotency-key"));
  if (!key.success) throw new AppError(400, "IDEMPOTENCY_KEY_REQUIRED", "An Idempotency-Key header is required");
  const outcome = await submitResult(id, parseId(req.params.stepId), key.data, resultSubmitSchema.parse(req.body));
  res.status(outcome.replayed ? 200 : 201).json(outcome);
});

learningRouter.post("/sessions/:id/steps/:stepId/advance", async (req, res) => {
  const id = await authorizedSession(req);
  res.json({ session: sessionView(await advanceStep(id, parseId(req.params.stepId))) });
});

learningRouter.get("/children/:id/progress", async (req, res) => {
  res.json({ progress: await getProgress(await authorizedChildId(req)) });
});

learningRouter.get("/children/:id/progress/:skillCode", async (req, res) => {
  const childId = await authorizedChildId(req);
  const skillCode = skillParam(req);
  const progress = (await getProgress(childId)).find((row) => row.skillCode === skillCode) ?? null;
  res.json({ progress, history: await getSkillHistory(childId, skillCode) });
});

learningRouter.post("/children/:id/progress/:skillCode/review", async (req, res) => {
  const childId = await authorizedChildId(req);
  const { decision } = masteryReviewSchema.parse(req.body);
  res.json({ progress: await reviewMastery(childId, skillParam(req), decision) });
});
