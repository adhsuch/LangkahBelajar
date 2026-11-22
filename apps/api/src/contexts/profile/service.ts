import { SKILL_CODES, type Preferences, type SkillCode } from "@langkahbelajar/shared";
import { notFound } from "../../lib/errors";
import { prisma } from "../../lib/prisma";

export interface ProfileSnapshot {
  preferences: Preferences;
  targets: SkillCode[];
}

/** The only view of a profile that Stepwise Learning may read. It is copied into each new session. */
export async function getProfileSnapshot(childId: string): Promise<ProfileSnapshot> {
  const child = await prisma.childProfile.findUnique({ where: { id: childId }, include: { preference: true, targets: true } });
  if (!child?.preference) throw notFound();
  const { audioEnabled, textSize, visualCues, responseMethod, reduceMotion } = child.preference;
  return {
    preferences: { audioEnabled, textSize, visualCues, responseMethod, reduceMotion },
    // A fixed order keeps every session predictable for the child.
    targets: SKILL_CODES.filter((code) => child.targets.some((target) => target.skillCode === code)),
  };
}
