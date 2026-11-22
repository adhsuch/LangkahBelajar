import { DEFAULT_PREFERENCES, SKILLS, SKILL_CODES, type Activity } from "@langkahbelajar/shared";
import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { hashToken } from "../src/contexts/identity/passwords";
import { config } from "../src/lib/config";
import { prisma } from "../src/lib/prisma";

const app = createApp();
const PASSWORD = "sample-password-123";

const template = (activityId: string, skillCode: Activity["skillCode"], level: number): Activity => ({
  activityId, version: "1", skillCode, level, title: activityId,
  steps: [{ instruction: "Pilih A" }],
  response: { kind: "choice", options: ["A", "B"] },
  hint: "Petunjuk",
  answerRule: { type: "exact", value: "A" },
});

let provider: Server;
let mode: "ok" | "down" | "empty" = "ok";
const providerRequests: IncomingMessage[] = [];

beforeAll(async () => {
  provider = createServer((req, res) => {
    providerRequests.push(req);
    if (mode === "down") return void res.writeHead(503).end("{}");
    const url = new URL(req.url!, "http://x");
    const skill = url.searchParams.get("skill_code") as Activity["skillCode"];
    const level = Number(url.searchParams.get("level"));
    const data =
      mode === "empty" ? []
      : url.pathname === "/v1/activities" ? [1, 2, 3].map((n) => template(`${skill}-${level}-${n}`, skill, level))
      : [{ materialId: `${skill}-${level}-m`, version: "1", skillCode: skill, level, format: url.searchParams.get("format") ?? "TEXT", mediaUrl: "data:text/plain,halo", title: "Materi" }];
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data, source: "live" }));
  });
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  (config as { INTEGRATION_URL: string }).INTEGRATION_URL = `http://127.0.0.1:${(provider.address() as AddressInfo).port}`;
  await Promise.all(SKILL_CODES.map((code) => prisma.skill.upsert({ where: { code }, create: { code, maxLevel: SKILLS[code].maxLevel }, update: {} })));
});

afterAll(async () => {
  provider.closeAllConnections();
  await new Promise((done) => provider.close(done));
  await prisma.$disconnect();
});

beforeEach(async () => {
  mode = "ok";
  providerRequests.length = 0;
  await prisma.$executeRawUnsafe(
    `TRUNCATE users, child_profiles, api_clients, material_cache, activity_cache, external_provider_logs CASCADE`,
  );
});

async function caregiver() {
  const agent = request.agent(app);
  const email = `caregiver-${randomUUID()}@example.test`;
  await agent.post("/api/auth/register").send({ email, password: PASSWORD, displayName: "Pendamping Contoh" }).expect(201);
  return { agent, email };
}

type Agent = Awaited<ReturnType<typeof caregiver>>["agent"];

async function child(agent: Agent, targets: string[] = ["READING"]) {
  const res = await agent.post("/api/children").send({ nickname: "Anak Contoh", targets, preferences: DEFAULT_PREFERENCES }).expect(201);
  return res.body.child.id as string;
}

async function startedSession(agent: Agent, childId: string, body: object = { durationMinutes: 5 }) {
  const created = await agent.post(`/api/children/${childId}/sessions`).send(body).expect(201);
  const started = await agent.patch(`/api/sessions/${created.body.session.id}/start`).expect(200);
  const advanced = await agent.post(`/api/sessions/${started.body.session.id}/steps/${started.body.session.currentStepId}/advance`).expect(200);
  return advanced.body.session;
}

const submit = (agent: Agent, sessionId: string, stepId: string, value = "A", supportUsed: string[] = [], key = randomUUID()) =>
  agent.post(`/api/sessions/${sessionId}/steps/${stepId}/results`).set("Idempotency-Key", key).send({ answer: { type: "choice", value }, supportUsed });

async function finish(agent: Agent, sessionId: string) {
  let session = (await agent.get(`/api/sessions/${sessionId}`).expect(200)).body.session;
  while (session.status !== "COMPLETED") {
    session = (await agent.post(`/api/sessions/${sessionId}/steps/${session.currentStepId}/advance`).expect(200)).body.session;
  }
  return session;
}

async function independentSession(agent: Agent, childId: string) {
  const session = await startedSession(agent, childId);
  await submit(agent, session.id, session.currentStepId).expect(201);
  await finish(agent, session.id);
}

describe("authentication", () => {
  it("logs in with valid credentials and rejects invalid ones", async () => {
    const { email } = await caregiver();
    await request(app).post("/api/auth/login").send({ email, password: PASSWORD }).expect(200);
    const denied = await request(app).post("/api/auth/login").send({ email, password: "wrong-password" }).expect(401);
    expect(denied.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("stores no plaintext password or token and sets a protected cookie", async () => {
    const agent = request(app);
    const email = `caregiver-${randomUUID()}@example.test`;
    const res = await agent.post("/api/auth/register").send({ email, password: PASSWORD, displayName: "Contoh" }).expect(201);
    const cookie = (res.headers["set-cookie"] as unknown as string[])[0]!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { authSessions: true } });
    expect(user.passwordHash).not.toContain(PASSWORD);
    const token = decodeURIComponent(cookie.split(";")[0]!.split("=")[1]!);
    expect(user.authSessions[0]!.tokenHash).toBe(hashToken(token));
  });

  it("requires a session on protected routes and ends it on logout", async () => {
    await request(app).get("/api/auth/me").expect(401);
    await request(app).get("/api/children").expect(401);
    const { agent } = await caregiver();
    await agent.get("/api/auth/me").expect(200);
    await agent.post("/api/auth/logout").expect(204);
    await agent.get("/api/auth/me").expect(401);
  });

  it("rejects an expired session", async () => {
    const { agent } = await caregiver();
    await prisma.authSession.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await agent.get("/api/auth/me").expect(401);
  });

  it("revokes other sessions when the password changes", async () => {
    const { agent, email } = await caregiver();
    const other = request.agent(app);
    await other.post("/api/auth/login").send({ email, password: PASSWORD }).expect(200);
    await agent.post("/api/auth/password").send({ currentPassword: PASSWORD, newPassword: "another-password-456" }).expect(204);
    await other.get("/api/auth/me").expect(401);
    await agent.get("/api/auth/me").expect(200);
  });
});

describe("child data access", () => {
  it("denies another caregiver on every child endpoint", async () => {
    const owner = await caregiver();
    const stranger = await caregiver();
    const childId = await child(owner.agent);
    const session = await startedSession(owner.agent, childId);
    const a = stranger.agent;

    const denied = [
      a.get(`/api/children/${childId}`),
      a.patch(`/api/children/${childId}`).send({ nickname: "X" }),
      a.post(`/api/children/${childId}/caregivers`).send({ email: stranger.email, role: "TEACHER" }),
      a.get(`/api/children/${childId}/learning-profile`),
      a.patch(`/api/children/${childId}/learning-profile`).send({ initialNotes: "x" }),
      a.get(`/api/children/${childId}/skills`),
      a.post(`/api/children/${childId}/sessions`).send({}),
      a.get(`/api/children/${childId}/sessions/resumable`),
      a.get(`/api/sessions/${session.id}`),
      a.patch(`/api/sessions/${session.id}/pause`),
      a.patch(`/api/sessions/${session.id}/resume`),
      a.patch(`/api/sessions/${session.id}/stop`),
      a.post(`/api/sessions/${session.id}/steps/${session.currentStepId}/advance`),
      a.post(`/api/sessions/${session.id}/steps/${session.currentStepId}/results`).set("Idempotency-Key", randomUUID()).send({ answer: { type: "choice", value: "A" } }),
      a.get(`/api/children/${childId}/progress`),
      a.get(`/api/children/${childId}/progress/READING`),
      a.post(`/api/children/${childId}/progress/READING/review`).send({ decision: "ADVANCE" }),
      a.get(`/api/children/${childId}/routines`),
      a.patch(`/api/children/${childId}/routines`).send({ days: [1], time: "16:00", durationMinutes: 5, breakMinutes: 2, remindersEnabled: false }),
      a.get(`/api/children/${childId}/notes`),
      a.post(`/api/children/${childId}/notes`).send({ body: "x" }),
      a.get(`/api/children/${childId}/summaries`),
    ];
    for (const call of denied) expect((await call).status).toBe(404);
    expect((await a.get("/api/children").expect(200)).body.children).toEqual([]);
  });

  it("lets a teacher and parent share a child, while only the owner can share", async () => {
    const parent = await caregiver();
    const teacher = await caregiver();
    const third = await caregiver();
    const childId = await child(parent.agent);
    await parent.agent.post(`/api/children/${childId}/caregivers`).send({ email: teacher.email, role: "TEACHER" }).expect(201);
    await teacher.agent.get(`/api/children/${childId}/progress`).expect(200);
    await teacher.agent.post(`/api/children/${childId}/caregivers`).send({ email: third.email, role: "TEACHER" }).expect(403);
  });

  it("rejects diagnosis fields on a profile", async () => {
    const { agent } = await caregiver();
    await agent.post("/api/children").send({ nickname: "Anak", targets: ["READING"], preferences: DEFAULT_PREFERENCES, diagnosis: "ADHD" }).expect(400);
    const id = await child(agent);
    await agent.patch(`/api/children/${id}/learning-profile`).send({ diagnosis: "ADHD" }).expect(400);
  });

  it("returns 404 for a malformed ID", async () => {
    const { agent } = await caregiver();
    await agent.get("/api/children/not-a-uuid").expect(404);
    await agent.get("/api/sessions/not-a-uuid").expect(404);
  });
});

describe("cross-group API keys", () => {
  it("enforces scope and exposes no child data", async () => {
    const key = "lb_test_partner_key";
    await prisma.apiClient.create({ data: { name: "partner", keyHash: hashToken(key), scopes: ["skills:read"] } });
    await prisma.apiClient.create({ data: { name: "no-scope", keyHash: hashToken("lb_no_scope"), scopes: [] } });
    await request(app).get("/api/partner/skills").expect(401);
    await request(app).get("/api/partner/skills").set("x-api-key", "lb_no_scope").expect(403);
    const res = await request(app).get("/api/partner/skills").set("x-api-key", key).expect(200);
    expect(Object.keys(res.body)).toEqual(["skills"]);
    await request(app).get("/api/children").set("x-api-key", key).expect(401);
  });
});

describe("sessions and results", () => {
  it("creates, pauses, resumes, and completes a session", async () => {
    const { agent } = await caregiver();
    const childId = await child(agent);
    const session = await startedSession(agent, childId);
    expect((await agent.patch(`/api/sessions/${session.id}/pause`).expect(200)).body.session.status).toBe("PAUSED");
    await submit(agent, session.id, session.currentStepId).expect(409);
    expect((await agent.patch(`/api/sessions/${session.id}/resume`).expect(200)).body.session.status).toBe("IN_PROGRESS");
    await submit(agent, session.id, session.currentStepId).expect(201);
    expect((await finish(agent, session.id)).status).toBe("COMPLETED");
    await agent.patch(`/api/sessions/${session.id}/pause`).expect(409);
  });

  it("never sends the answer rule to the client", async () => {
    const { agent } = await caregiver();
    const session = await startedSession(agent, await child(agent));
    expect(JSON.stringify(session)).not.toContain("answerRule");
    const list = await agent.get("/api/activities?skill=READING&level=1").expect(200);
    expect(JSON.stringify(list.body)).not.toContain("answerRule");
  });

  it("does not duplicate a result resubmitted with the same key", async () => {
    const { agent } = await caregiver();
    const childId = await child(agent);
    const session = await startedSession(agent, childId);
    const key = randomUUID();
    const first = await submit(agent, session.id, session.currentStepId, "A", [], key).expect(201);
    const replay = await submit(agent, session.id, session.currentStepId, "A", [], key).expect(200);
    expect(replay.body.replayed).toBe(true);
    expect(replay.body.result.id).toBe(first.body.result.id);
    expect(await prisma.exerciseResult.count({ where: { childId } })).toBe(1);
  });

  it("handles concurrent resubmission as one result", async () => {
    const { agent } = await caregiver();
    const childId = await child(agent);
    const session = await startedSession(agent, childId);
    const key = randomUUID();
    const responses = await Promise.all(Array.from({ length: 5 }, () => submit(agent, session.id, session.currentStepId, "A", [], key)));
    expect(responses.map((r) => r.status).sort()).toEqual([200, 200, 200, 200, 201]);
    expect(await prisma.exerciseResult.count({ where: { childId } })).toBe(1);
  });

  it("rejects a reused key with a different answer", async () => {
    const { agent } = await caregiver();
    const session = await startedSession(agent, await child(agent));
    const key = randomUUID();
    await submit(agent, session.id, session.currentStepId, "B", [], key).expect(201);
    const conflict = await submit(agent, session.id, session.currentStepId, "A", [], key).expect(409);
    expect(conflict.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("requires an idempotency key", async () => {
    const { agent } = await caregiver();
    const session = await startedSession(agent, await child(agent));
    await agent.post(`/api/sessions/${session.id}/steps/${session.currentStepId}/results`).send({ answer: { type: "choice", value: "A" } }).expect(400);
  });

  it("keeps state after a stop and resumes at the same step", async () => {
    const { agent } = await caregiver();
    const session = await startedSession(agent, await child(agent));
    await submit(agent, session.id, session.currentStepId).expect(201);
    const before = (await agent.get(`/api/sessions/${session.id}`)).body.session;
    const stopped = (await agent.patch(`/api/sessions/${session.id}/stop`).expect(200)).body.session;
    expect(stopped.status).toBe("STOPPED");
    const resumed = (await agent.patch(`/api/sessions/${session.id}/resume`).expect(200)).body.session;
    expect(resumed.currentStepId).toBe(before.currentStepId);
  });

  it("allows one active session per child", async () => {
    const { agent } = await caregiver();
    const childId = await child(agent);
    await startedSession(agent, childId);
    const blocked = await agent.post(`/api/children/${childId}/sessions`).send({}).expect(409);
    expect(blocked.body.error.code).toBe("SESSION_ALREADY_ACTIVE");
  });

  it("does not let a profile change alter a running session", async () => {
    const { agent } = await caregiver();
    const childId = await child(agent);
    const session = await startedSession(agent, childId);
    await agent.patch(`/api/children/${childId}/learning-profile`).send({ preferences: { textSize: "XLARGE" }, targets: ["COUNTING"] }).expect(200);
    const after = (await agent.get(`/api/sessions/${session.id}`)).body.session;
    expect(after.profileSnapshot.preferences.textSize).toBe(DEFAULT_PREFERENCES.textSize);
    expect(after.profileSnapshot.targets).toEqual(["READING"]);
  });

  it("does not change mastery when a session is paused many times", async () => {
    const { agent } = await caregiver();
    const childId = await child(agent);
    await independentSession(agent, childId);
    const before = (await agent.get(`/api/children/${childId}/progress`)).body.progress;
    const session = await startedSession(agent, childId);
    for (let i = 0; i < 5; i += 1) {
      await agent.patch(`/api/sessions/${session.id}/pause`).expect(200);
      await agent.patch(`/api/sessions/${session.id}/resume`).expect(200);
    }
    await agent.patch(`/api/sessions/${session.id}/stop`).expect(200);
    expect((await agent.get(`/api/children/${childId}/progress`)).body.progress).toEqual(before);
  });
});

describe("mastery", () => {
  it("offers the next stage after independent success in two different sessions", async () => {
    const { agent } = await caregiver();
    const childId = await child(agent);
    await independentSession(agent, childId);
    expect((await agent.get(`/api/children/${childId}/progress`)).body.progress[0]).toMatchObject({ status: "PRACTICING", independentSessions: 1 });
    await independentSession(agent, childId);
    expect((await agent.get(`/api/children/${childId}/progress`)).body.progress[0]).toMatchObject({ status: "NEXT_STAGE_OFFERED", independentSessions: 2, currentLevel: 1 });
  });

  it("does not count two successes in the same session as two sessions", async () => {
    const { agent } = await caregiver();
    const childId = await child(agent);
    let session = await startedSession(agent, childId);
    await submit(agent, session.id, session.currentStepId).expect(201);
    session = (await agent.get(`/api/sessions/${session.id}`)).body.session;
    session = (await agent.post(`/api/sessions/${session.id}/steps/${session.currentStepId}/advance`).expect(200)).body.session;
    await submit(agent, session.id, session.currentStepId).expect(201);
    expect((await agent.get(`/api/children/${childId}/progress`)).body.progress[0].independentSessions).toBe(1);
  });

  it("does not count a success that used a hint", async () => {
    const { agent } = await caregiver();
    const childId = await child(agent);
    for (let i = 0; i < 2; i += 1) {
      const session = await startedSession(agent, childId);
      await submit(agent, session.id, session.currentStepId, "A", ["HINT"]).expect(201);
      await finish(agent, session.id);
    }
    expect((await agent.get(`/api/children/${childId}/progress`)).body.progress[0]).toMatchObject({ status: "PRACTICING", independentSessions: 0 });
  });

  it("keeps skills separate", async () => {
    const { agent } = await caregiver();
    const childId = await child(agent, ["COUNTING", "READING"]);
    for (let i = 0; i < 2; i += 1) {
      const session = await startedSession(agent, childId, { durationMinutes: 5, skillCodes: ["COUNTING"] });
      await submit(agent, session.id, session.currentStepId).expect(201);
      await finish(agent, session.id);
    }
    const progress = (await agent.get(`/api/children/${childId}/progress`)).body.progress as { skillCode: string; status: string; independentSessions: number }[];
    expect(progress.find((row) => row.skillCode === "COUNTING")?.status).toBe("NEXT_STAGE_OFFERED");
    expect(progress.find((row) => row.skillCode === "READING")).toMatchObject({ status: "PRACTICING", independentSessions: 0 });
  });

  it("does not count starter activities toward mastery", async () => {
    const { agent } = await caregiver();
    const childId = await child(agent);
    for (let i = 0; i < 2; i += 1) {
      const session = await startedSession(agent, childId, { type: "STARTER", skillCodes: ["READING"] });
      await submit(agent, session.id, session.currentStepId).expect(201);
      await finish(agent, session.id);
    }
    expect((await agent.get(`/api/children/${childId}/progress`)).body.progress[0].independentSessions).toBe(0);
  });

  it("lets the caregiver advance or keep practicing", async () => {
    const { agent } = await caregiver();
    const childId = await child(agent);
    await agent.post(`/api/children/${childId}/progress/READING/review`).send({ decision: "ADVANCE" }).expect(409);
    await independentSession(agent, childId);
    await independentSession(agent, childId);
    const kept = (await agent.post(`/api/children/${childId}/progress/READING/review`).send({ decision: "KEEP_PRACTICING" }).expect(200)).body.progress[0];
    expect(kept).toMatchObject({ status: "PRACTICING", currentLevel: 1 });
    await independentSession(agent, childId);
    const offered = (await agent.get(`/api/children/${childId}/progress`)).body.progress[0];
    expect(offered.status).toBe("NEXT_STAGE_OFFERED");
    const advanced = (await agent.post(`/api/children/${childId}/progress/READING/review`).send({ decision: "ADVANCE" }).expect(200)).body.progress[0];
    expect(advanced).toMatchObject({ status: "PRACTICING", currentLevel: 2, independentSessions: 0 });
    const next = await startedSession(agent, childId);
    expect(next.steps.find((step: { kind: string }) => step.kind === "PRACTICE").level).toBe(2);
  });

  it("builds a read-only summary without changing results", async () => {
    const { agent } = await caregiver();
    const childId = await child(agent);
    const session = await startedSession(agent, childId);
    await submit(agent, session.id, session.currentStepId).expect(201);
    const before = await prisma.exerciseResult.findMany({ where: { childId } });
    await finish(agent, session.id);
    const after = await prisma.exerciseResult.findMany({ where: { childId } });
    expect(after).toEqual(before);
    const { summaries } = (await agent.get(`/api/children/${childId}/summaries`).expect(200)).body;
    expect(summaries).toHaveLength(1);
    expect(summaries[0].skills[0]).toMatchObject({ skillCode: "READING", completed: 1, skipped: 1, independent: 1 });
    expect(JSON.stringify(summaries)).not.toMatch(/diagnos/i);
    await agent.patch(`/api/children/${childId}/summaries`).send({}).expect(404);
  });
});

describe("caregiver support", () => {
  it("configures a routine and stores notes", async () => {
    const { agent } = await caregiver();
    const childId = await child(agent);
    expect((await agent.get(`/api/children/${childId}/routines`).expect(200)).body.isDefault).toBe(true);
    const routine = { days: [5, 1, 1], time: "15:30", durationMinutes: 15, breakMinutes: 3, remindersEnabled: true };
    expect((await agent.patch(`/api/children/${childId}/routines`).send(routine).expect(200)).body.routine.days).toEqual([1, 5]);
    await agent.patch(`/api/children/${childId}/routines`).send({ ...routine, time: "25:00" }).expect(400);
    await agent.post(`/api/children/${childId}/notes`).send({ body: "Lebih nyaman dengan audio", skillCode: "READING" }).expect(201);
    expect((await agent.get(`/api/children/${childId}/notes?skill=READING`).expect(200)).body.notes).toHaveLength(1);
  });

  it("rejects a note linked to another child's session", async () => {
    const { agent } = await caregiver();
    const first = await child(agent);
    const second = await child(agent);
    const session = await startedSession(agent, first);
    await agent.post(`/api/children/${second}/notes`).send({ body: "x", sessionId: session.id }).expect(422);
  });
});

describe("integration", () => {
  it("sends providers only skill code, level, and format", async () => {
    const { agent } = await caregiver();
    await startedSession(agent, await child(agent));
    expect(providerRequests.length).toBeGreaterThan(0);
    for (const req of providerRequests) {
      const url = new URL(req.url!, "http://x");
      expect([...url.searchParams.keys()].every((key) => ["skill_code", "level", "format"].includes(key))).toBe(true);
      expect(req.headers.cookie).toBeUndefined();
      expect(req.url).not.toContain("Anak");
    }
  });

  it("uses stored activities and materials when the integration is down", async () => {
    const { agent } = await caregiver();
    const childId = await child(agent);
    await agent.get("/api/materials?skill=READING&level=1&format=AUDIO").expect(200);
    const live = await startedSession(agent, childId);
    await agent.patch(`/api/sessions/${live.id}/stop`).expect(200);
    mode = "down";
    const materials = await agent.get("/api/materials?skill=READING&level=1&format=AUDIO").expect(200);
    expect(materials.body).toMatchObject({ source: "cache", degraded: true, reason: "UPSTREAM_ERROR" });
    expect(materials.body.materials).toHaveLength(1);
    const offline = await agent.post(`/api/children/${childId}/sessions`).send({ durationMinutes: 5 }).expect(201);
    expect(offline.body.session.steps.some((step: { kind: string; activity: unknown }) => step.kind === "PRACTICE" && step.activity)).toBe(true);
  });

  it("ignores stored items past their validity", async () => {
    const { agent } = await caregiver();
    await agent.get("/api/materials?skill=READING&level=1&format=AUDIO").expect(200);
    await prisma.materialCache.updateMany({ data: { validUntil: new Date(Date.now() - 1000) } });
    mode = "down";
    expect((await agent.get("/api/materials?skill=READING&level=1&format=AUDIO").expect(200)).body.materials).toEqual([]);
  });

  it("postpones with a clear error and keeps progress when nothing is stored", async () => {
    const { agent } = await caregiver();
    const childId = await child(agent, ["COUNTING"]);
    await independentSession(agent, childId);
    await prisma.activityCache.deleteMany();
    mode = "down";
    const res = await agent.post(`/api/children/${childId}/sessions`).send({}).expect(503);
    expect(res.body.error.code).toBe("ACTIVITIES_UNAVAILABLE");
    expect((await agent.get(`/api/children/${childId}/progress`)).body.progress[0].independentSessions).toBe(1);
    expect(await prisma.exerciseResult.count({ where: { childId } })).toBe(1);
  });

  it("shows a fallback for an empty provider response", async () => {
    const { agent } = await caregiver();
    mode = "empty";
    const res = await agent.get("/api/materials?skill=READING&level=1").expect(200);
    expect(res.body).toMatchObject({ materials: [], source: "cache", degraded: true, reason: "EMPTY" });
  });

  it("logs provider calls without child data and reports status", async () => {
    const { agent } = await caregiver();
    await agent.get("/api/materials?skill=READING&level=1").expect(200);
    const status = await agent.get("/api/integrations/status").expect(200);
    expect(status.body.storedItems.materials).toBe(1);
    const logged = await prisma.externalProviderLog.findFirstOrThrow();
    expect(Object.keys(logged)).not.toContain("childId");
  });

  it("requires a session for catalog routes", async () => {
    await request(app).get("/api/materials?skill=READING&level=1").expect(401);
    await request(app).get("/api/integrations/status").expect(401);
  });
});
