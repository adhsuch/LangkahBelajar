import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { translateActivities, translateMaterials } from "../src/acl";
import { createIntegrationApp } from "../src/app";
import { ProviderClient } from "../src/provider-client";

const material = { material_id: "m1", version: 2, skill_code: "READING", level: 1, format: "VISUAL", media_url: "https://cdn.example.test/a.png" };
const activity = {
  activity_id: "a1", version: "3", skill_code: "COUNTING",
  steps: [{ instruction: "Ada berapa?", options: ["1", "2"] }],
  answer_rule: { type: "exact", value: "2" },
};

type Handler = (req: IncomingMessage, res: ServerResponse) => void;
let server: Server;
let handler: Handler;
const seen: IncomingMessage[] = [];
const json = (res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
};

function appFor(baseUrl: string, timeoutMs = 300, retries = 1) {
  const client = (name: string) => new ProviderClient({ name, baseUrl, timeoutMs, retries, retryDelayMs: 1 });
  return createIntegrationApp({ apiKey: "test-key", materials: client("materials"), activities: client("activities"), cacheTtlMs: 60_000 });
}
const baseUrl = () => `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const get = (app: ReturnType<typeof appFor>, path: string) => request(app).get(path).set("x-api-key", "test-key");

beforeEach(async () => {
  seen.length = 0;
  handler = (_req, res) => json(res, 200, { data: [material] });
  server = createServer((req, res) => {
    seen.push(req);
    handler(req, res);
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
});

describe("ACL", () => {
  it("normalizes a material and keeps its identity and version", () => {
    expect(translateMaterials({ data: [material] })[0]).toMatchObject({ materialId: "m1", version: "2", skillCode: "READING", mediaUrl: material.media_url });
  });

  it("derives the response kind and uses the requested level when the provider omits it", () => {
    expect(translateActivities({ data: [activity] }, 2)[0]).toMatchObject({ activityId: "a1", version: "3", level: 2, response: { kind: "choice", options: ["1", "2"] } });
  });

  it("drops invalid records and keeps valid ones", () => {
    let rejected = 0;
    const items = translateMaterials({ data: [material, { ...material, skill_code: "UNKNOWN" }] }, (count) => (rejected = count));
    expect(items).toHaveLength(1);
    expect(rejected).toBe(1);
  });

  it.each(["javascript:alert(1)", "http://insecure.example/x.png", "data:text/html,<script>1</script>"])("rejects unsafe media %s", (media_url) => {
    expect(translateMaterials({ data: [{ ...material, media_url }] })).toHaveLength(0);
  });

  it("rejects an answer rule that no option can satisfy", () => {
    expect(translateActivities({ data: [{ ...activity, answer_rule: { type: "exact", value: "9" } }] }, 1)).toHaveLength(0);
  });
});

describe("integration service", () => {
  it("requires its API key", async () => {
    await request(appFor(baseUrl())).get("/v1/materials?skill_code=READING&level=1").expect(401);
  });

  it("forwards only skill code, level, and format", async () => {
    const app = appFor(baseUrl());
    await get(app, "/v1/materials?skill_code=READING&level=1&format=VISUAL").expect(200);
    const url = new URL(seen[0]!.url!, "http://x");
    expect([...url.searchParams.keys()].sort()).toEqual(["format", "level", "skill_code"]);
    expect(seen[0]!.headers.cookie).toBeUndefined();
  });

  it("refuses queries carrying child data", async () => {
    await get(appFor(baseUrl()), "/v1/materials?skill_code=READING&level=1&child_id=abc").expect(400);
    await get(appFor(baseUrl()), "/v1/activities?skill_code=READING&level=1&nickname=abc").expect(400);
    expect(seen).toHaveLength(0);
  });

  it("retries a 5xx once and then succeeds", async () => {
    let calls = 0;
    handler = (_req, res) => (++calls === 1 ? json(res, 500, {}) : json(res, 200, { data: [material] }));
    const response = await get(appFor(baseUrl()), "/v1/materials?skill_code=READING&level=1").expect(200);
    expect(calls).toBe(2);
    expect(response.body.source).toBe("live");
  });

  it("reports a timeout without crashing", async () => {
    handler = () => undefined;
    const response = await get(appFor(baseUrl(), 40, 0), "/v1/materials?skill_code=READING&level=1").expect(504);
    expect(response.body.error.code).toBe("TIMEOUT");
  });

  it("honors Retry-After and stops calling the provider", async () => {
    handler = (_req, res) => json(res, 429, {}, { "retry-after": "60" });
    const app = appFor(baseUrl());
    await get(app, "/v1/materials?skill_code=READING&level=1").expect(429);
    await get(app, "/v1/materials?skill_code=READING&level=1").expect(429);
    expect(seen).toHaveLength(1);
  });

  it("serves the last good data when the provider fails", async () => {
    const app = appFor(baseUrl());
    await get(app, "/v1/materials?skill_code=READING&level=1").expect(200);
    handler = (_req, res) => json(res, 500, {});
    const response = await get(app, "/v1/materials?skill_code=READING&level=1").expect(200);
    expect(response.body.source).toBe("cache");
    expect(response.body.data[0].materialId).toBe("m1");
  });

  it("treats a malformed envelope as a provider error", async () => {
    handler = (_req, res) => json(res, 200, { nope: true });
    const response = await get(appFor(baseUrl()), "/v1/materials?skill_code=READING&level=1").expect(502);
    expect(response.body.error.code).toBe("INVALID_RESPONSE");
  });
});
