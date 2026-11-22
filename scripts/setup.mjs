// One-command local setup: env files, database, migrations, synthetic seed data.
import { execSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";

for (const app of ["api", "integration", "provider-sim"]) {
  const target = `apps/${app}/.env`;
  if (!existsSync(target)) copyFileSync(`apps/${app}/.env.example`, target);
}
for (const command of ["node scripts/dev-db.mjs start", "npm run db:deploy -w @langkahbelajar/api", "npm run db:seed"]) {
  execSync(command, { stdio: "inherit" });
}
