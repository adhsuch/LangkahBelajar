import { childCreateSchema, childUpdateSchema, learningProfileUpdateSchema, shareChildSchema } from "@langkahbelajar/shared";
import { Router } from "express";
import { AppError, notFound } from "../../lib/errors";
import { isUniqueViolation, prisma } from "../../lib/prisma";
import { assertChildAccess, authorizedChildId, currentUser, requireAuth } from "../identity/access";
import { authLimiter } from "../identity/routes";
import { getProfileSnapshot } from "./service";

export const profileRouter = Router();
profileRouter.use("/children", requireAuth);

const childView = (child: { id: string; nickname: string; isSample: boolean; createdAt: Date }, relation: { role: string; isOwner: boolean }) => ({
  id: child.id,
  nickname: child.nickname,
  isSample: child.isSample,
  createdAt: child.createdAt,
  role: relation.role,
  isOwner: relation.isOwner,
});

profileRouter.get("/children", async (req, res) => {
  const relations = await prisma.caregiverChildRelation.findMany({
    where: { caregiverId: currentUser(req).id },
    include: { child: true },
    orderBy: { createdAt: "asc" },
  });
  res.json({ children: relations.map((relation) => childView(relation.child, relation)) });
});

profileRouter.post("/children", async (req, res) => {
  const input = childCreateSchema.parse(req.body);
  const relation = { caregiverId: currentUser(req).id, role: "PARENT" as const, isOwner: true };
  const child = await prisma.childProfile.create({
    data: {
      nickname: input.nickname,
      initialNotes: input.initialNotes || null,
      relations: { create: relation },
      preference: { create: input.preferences },
      targets: { create: input.targets.map((skillCode) => ({ skillCode })) },
    },
  });
  res.status(201).json({ child: childView(child, relation) });
});

profileRouter.get("/children/:id", async (req, res) => {
  const childId = await authorizedChildId(req);
  const relation = await assertChildAccess(currentUser(req).id, childId);
  const child = await prisma.childProfile.findUniqueOrThrow({ where: { id: childId } });
  res.json({ child: childView(child, relation) });
});

profileRouter.patch("/children/:id", async (req, res) => {
  const childId = await authorizedChildId(req);
  const input = childUpdateSchema.parse(req.body);
  const relation = await assertChildAccess(currentUser(req).id, childId);
  const child = await prisma.childProfile.update({ where: { id: childId }, data: input });
  res.json({ child: childView(child, relation) });
});

profileRouter.post("/children/:id/caregivers", authLimiter, async (req, res) => {
  const childId = await authorizedChildId(req);
  const relation = await assertChildAccess(currentUser(req).id, childId);
  if (!relation.isOwner) throw new AppError(403, "OWNER_REQUIRED", "Only the profile owner can share access");
  const input = shareChildSchema.parse(req.body);
  const caregiver = await prisma.user.findUnique({ where: { email: input.email } });
  if (!caregiver) throw notFound();
  try {
    await prisma.caregiverChildRelation.create({ data: { caregiverId: caregiver.id, childId, role: input.role } });
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError(409, "ALREADY_SHARED", "This caregiver already has access");
    throw error;
  }
  res.status(201).json({ caregiver: { displayName: caregiver.displayName, role: input.role } });
});

async function learningProfileView(childId: string) {
  const [snapshot, child] = await Promise.all([getProfileSnapshot(childId), prisma.childProfile.findUniqueOrThrow({ where: { id: childId } })]);
  return { ...snapshot, initialNotes: child.initialNotes ?? "" };
}

profileRouter.get("/children/:id/learning-profile", async (req, res) => {
  res.json({ learningProfile: await learningProfileView(await authorizedChildId(req)) });
});

profileRouter.patch("/children/:id/learning-profile", async (req, res) => {
  const childId = await authorizedChildId(req);
  const input = learningProfileUpdateSchema.parse(req.body);
  await prisma.$transaction(async (tx) => {
    if (input.preferences) await tx.learningPreference.update({ where: { childId }, data: input.preferences });
    if (input.initialNotes !== undefined) await tx.childProfile.update({ where: { id: childId }, data: { initialNotes: input.initialNotes || null } });
    if (input.targets) {
      await tx.skillTarget.deleteMany({ where: { childId } });
      await tx.skillTarget.createMany({ data: input.targets.map((skillCode) => ({ childId, skillCode })) });
    }
  });
  res.json({ learningProfile: await learningProfileView(childId) });
});
