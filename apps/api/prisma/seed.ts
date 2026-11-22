import { DEFAULT_PREFERENCES, SKILLS, SKILL_CODES } from "@langkahbelajar/shared";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/contexts/identity/passwords";

const prisma = new PrismaClient();

// Synthetic demo accounts. The password comes from the environment and is never committed.
const SAMPLE_CAREGIVER_EMAIL = "pendamping.contoh@example.test";

async function main() {
  await Promise.all(SKILL_CODES.map((code) => prisma.skill.upsert({ where: { code }, create: { code, maxLevel: SKILLS[code].maxLevel }, update: { maxLevel: SKILLS[code].maxLevel } })));

  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password) {
    console.log("Skills seeded. Set SEED_DEMO_PASSWORD to also create the synthetic demo caregiver.");
    return;
  }
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email: SAMPLE_CAREGIVER_EMAIL },
    create: { email: SAMPLE_CAREGIVER_EMAIL, displayName: "Pendamping Contoh", passwordHash },
    update: { passwordHash },
  });
  const existing = await prisma.caregiverChildRelation.findFirst({ where: { caregiverId: user.id, child: { isSample: true } } });
  if (!existing) {
    await prisma.childProfile.create({
      data: {
        nickname: "Anak Contoh",
        isSample: true,
        initialNotes: "Data contoh sintetis untuk demonstrasi.",
        relations: { create: { caregiverId: user.id, role: "PARENT", isOwner: true } },
        preference: { create: DEFAULT_PREFERENCES },
        targets: { create: [{ skillCode: "READING" }, { skillCode: "COUNTING" }, { skillCode: "INSTRUCTIONS" }] },
        routine: { create: { days: [1, 3, 5], time: "16:00", durationMinutes: 10, breakMinutes: 2, remindersEnabled: true } },
      },
    });
  }
  console.log(`Synthetic demo caregiver ready: ${SAMPLE_CAREGIVER_EMAIL}`);
}

main().finally(() => prisma.$disconnect());
