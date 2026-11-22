import { SKILLS, SKILL_CODES } from "@langkahbelajar/shared";
import { createApp } from "./app";
import { config } from "./lib/config";
import { log } from "./lib/logger";
import { prisma } from "./lib/prisma";

async function main() {
  // Skills are reference data the app cannot run without, so they do not depend on a manual seed.
  await Promise.all(SKILL_CODES.map((code) => prisma.skill.upsert({ where: { code }, create: { code, maxLevel: SKILLS[code].maxLevel }, update: { maxLevel: SKILLS[code].maxLevel } })));
  const server = createApp().listen(config.PORT, () => log("info", "server_started", { port: config.PORT }));
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => server.close(() => void prisma.$disconnect().finally(() => process.exit(0))));
  }
}

main().catch((error) => {
  log("error", "startup_failed", { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
