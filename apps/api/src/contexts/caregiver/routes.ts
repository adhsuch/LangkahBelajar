import { noteCreateSchema, routineUpdateSchema, skillCodeSchema } from "@langkahbelajar/shared";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import { AppError } from "../../lib/errors";
import { prisma, type Tx } from "../../lib/prisma";
import { authorizedChildId, currentUser, requireAuth } from "../identity/access";
import type { SessionCompleted } from "../learning/events";

export const caregiverRouter = Router();
caregiverRouter.use("/children", requireAuth);

const DEFAULT_ROUTINE = { days: [1, 2, 3, 4, 5], time: "16:00", durationMinutes: 10, breakMinutes: 2, remindersEnabled: false };

/** Writes only this context's read model, so a summary can never alter exercise results. */
export async function saveSessionSummary(event: SessionCompleted, tx: Tx) {
  const data = { completedAt: event.completedAt, skills: event.skills } as unknown as Prisma.InputJsonValue;
  await tx.sessionSummary.upsert({ where: { sessionId: event.sessionId }, create: { sessionId: event.sessionId, childId: event.childId, data }, update: {} });
}

const routineView = ({ days, time, durationMinutes, breakMinutes, remindersEnabled }: typeof DEFAULT_ROUTINE) => ({ days, time, durationMinutes, breakMinutes, remindersEnabled });

caregiverRouter.get("/children/:id/routines", async (req, res) => {
  const childId = await authorizedChildId(req);
  const routine = await prisma.routine.findUnique({ where: { childId } });
  res.json({ routine: routineView(routine ?? DEFAULT_ROUTINE), isDefault: !routine });
});

caregiverRouter.patch("/children/:id/routines", async (req, res) => {
  const childId = await authorizedChildId(req);
  const input = routineUpdateSchema.parse(req.body);
  const routine = await prisma.routine.upsert({ where: { childId }, create: { childId, ...input }, update: input });
  res.json({ routine: routineView(routine), isDefault: false });
});

caregiverRouter.get("/children/:id/notes", async (req, res) => {
  const childId = await authorizedChildId(req);
  const skill = req.query.skill === undefined ? undefined : skillCodeSchema.parse(req.query.skill);
  const notes = await prisma.caregiverNote.findMany({
    where: { childId, ...(skill ? { skillCode: skill } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { author: { select: { displayName: true } } },
  });
  res.json({ notes: notes.map((note) => ({ id: note.id, body: note.body, skillCode: note.skillCode, sessionId: note.sessionId, createdAt: note.createdAt, authorName: note.author.displayName })) });
});

caregiverRouter.post("/children/:id/notes", async (req, res) => {
  const childId = await authorizedChildId(req);
  const input = noteCreateSchema.parse(req.body);
  if (input.sessionId) {
    const session = await prisma.learningSession.findFirst({ where: { id: input.sessionId, childId }, select: { id: true } });
    if (!session) throw new AppError(422, "INVALID_SESSION", "The session does not belong to this child");
  }
  const note = await prisma.caregiverNote.create({ data: { ...input, childId, authorId: currentUser(req).id } });
  res.status(201).json({ note: { id: note.id, body: note.body, skillCode: note.skillCode, sessionId: note.sessionId, createdAt: note.createdAt, authorName: currentUser(req).displayName } });
});

caregiverRouter.get("/children/:id/summaries", async (req, res) => {
  const childId = await authorizedChildId(req);
  const rows = await prisma.sessionSummary.findMany({ where: { childId }, orderBy: { createdAt: "desc" }, take: 20 });
  res.json({ summaries: rows.map((row) => ({ sessionId: row.sessionId, ...(row.data as object) })) });
});
