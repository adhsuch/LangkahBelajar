import { materialFormatSchema, skillCodeSchema, type Activity } from "@langkahbelajar/shared";
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../contexts/identity/access";
import { getActivities, getMaterials, integrationStatus, storedMaterials } from "./catalog";

export const integrationRouter = Router();
integrationRouter.use(["/materials", "/activities", "/integrations"], requireAuth);

const query = z.object({ skill: skillCodeSchema, level: z.coerce.number().int().min(1).max(10) });

integrationRouter.get("/materials/stored", async (_req, res) => {
  res.json({ materials: await storedMaterials() });
});

integrationRouter.get("/materials", async (req, res) => {
  const { skill, level, format } = query.extend({ format: materialFormatSchema.optional() }).parse(req.query);
  const { items, ...meta } = await getMaterials(skill, level, format);
  res.json({ materials: items, ...meta });
});

const publicActivity = ({ answerRule: _answerRule, ...activity }: Activity) => activity;

integrationRouter.get("/activities", async (req, res) => {
  const { skill, level } = query.parse(req.query);
  const { items, ...meta } = await getActivities(skill, level);
  res.json({ activities: items.map(publicActivity), ...meta });
});

integrationRouter.get("/integrations/status", async (_req, res) => {
  res.json(await integrationStatus());
});
