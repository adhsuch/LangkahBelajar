// Runs a project-local PostgreSQL cluster so development never touches another server on this machine.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, ".dev-db");
const port = process.env.DEV_DB_PORT ?? "55432";
const exe = process.platform === "win32" ? ".exe" : "";

function binary(name) {
  const base = "C:\\Program Files\\PostgreSQL";
  if (process.platform === "win32" && existsSync(base)) {
    const version = readdirSync(base).sort((a, b) => Number(b) - Number(a))[0];
    if (version) return join(base, version, "bin", name + exe);
  }
  return name;
}

function run(name, args) {
  execFileSync(binary(name), args, { stdio: "inherit" });
}

const isRunning = () => spawnSync(binary("pg_ctl"), ["status", "-D", dataDir]).status === 0;

const command = process.argv[2];
if (command === "start") {
  if (!existsSync(join(dataDir, "PG_VERSION"))) {
    // shortcut: trust auth on 127.0.0.1 for a synthetic-data dev cluster, use Docker secrets on the STB.
    run("initdb", ["-D", dataDir, "-U", "langkah", "--auth=trust", "--encoding=UTF8", "--locale=C"]);
  }
  if (!isRunning()) {
    // Detached stdio stops pg_ctl from holding the parent shell open on Windows.
    spawnSync(binary("pg_ctl"), ["start", "-w", "-D", dataDir, "-l", join(dataDir, "server.log"), "-o", `-p ${port} -h 127.0.0.1`], { stdio: "ignore" });
    if (!isRunning()) throw new Error(`PostgreSQL did not start, see ${join(dataDir, "server.log")}`);
  }
  for (const db of ["langkahbelajar", "langkahbelajar_test"]) {
    spawnSync(binary("createdb"), ["-h", "127.0.0.1", "-p", port, "-U", "langkah", db], { stdio: "ignore" });
  }
  console.log(`PostgreSQL is running on 127.0.0.1:${port}`);
} else if (command === "stop") {
  if (isRunning()) run("pg_ctl", ["stop", "-D", dataDir, "-m", "fast"]);
} else {
  console.error("Usage: node scripts/dev-db.mjs start|stop");
  process.exit(1);
}
