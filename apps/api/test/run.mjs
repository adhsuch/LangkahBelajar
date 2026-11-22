// Applies migrations to the dedicated test database, then runs Vitest against it.
import { execSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const env = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://langkah@127.0.0.1:55432/langkahbelajar_test",
  INTEGRATION_URL: "http://127.0.0.1:1",
  INTEGRATION_API_KEY: "test-key",
  INTEGRATION_TIMEOUT_MS: "500",
  AUTH_RATE_LIMIT_MAX: "100000",
  WEB_DIST: "./missing-web-dist",
};
execSync("npx prisma migrate deploy", { env, stdio: "pipe" });

const vitest = join(dirname(createRequire(import.meta.url).resolve("vitest/package.json")), "vitest.mjs");
const run = () => spawnSync(process.execPath, [vitest, "run", "--no-file-parallelism", "--pool=threads"], { env, stdio: "inherit" }).status;
const crashed = (status) => status === null || status > 255;

let status = run();
// shortcut: the Vitest process sometimes dies natively on Windows with Node 24, rerun once until the root cause is found.
// Test failures exit with 1 and are never retried.
if (crashed(status)) {
  console.warn(`Test process crashed natively (exit ${status}). Rerunning once.`);
  status = run();
}
process.exit(crashed(status) ? 1 : (status ?? 1));
