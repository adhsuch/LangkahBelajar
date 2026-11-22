import { catalogQuerySchema } from "@langkahbelajar/shared";
import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import { timingSafeEqual } from "node:crypto";
import { ZodError } from "zod";
import { translateActivities, translateMaterials } from "./acl";
import { ProviderClient, ProviderError } from "./provider-client";

export interface IntegrationDeps {
  apiKey: string;
  materials: ProviderClient;
  activities: ProviderClient;
  cacheTtlMs: number;
  log?: (event: string, fields: Record<string, unknown>) => void;
}

const STATUS_BY_CODE = { TIMEOUT: 504, RATE_LIMITED: 429, UPSTREAM_ERROR: 502, UNREACHABLE: 503, INVALID_RESPONSE: 502 } as const;

export function createIntegrationApp({ apiKey, materials, activities, cacheTtlMs, log }: IntegrationDeps) {
  const app = express();
  app.disable("x-powered-by");
  // shortcut: in-memory last-good cache, the core keeps the durable copy in PostgreSQL.
  const cache = new Map<string, { data: unknown[]; storedAt: number }>();

  const requireKey: RequestHandler = (req, res, next) => {
    const given = Buffer.from(req.get("x-api-key") ?? "");
    const expected = Buffer.from(apiKey);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      res.status(401).json({ error: { code: "INVALID_API_KEY" } });
      return;
    }
    next();
  };

  async function serve(key: string, load: () => Promise<unknown[]>) {
    try {
      const data = await load();
      if (data.length > 0) cache.set(key, { data, storedAt: Date.now() });
      return { data, source: "live" as const };
    } catch (error) {
      const stored = cache.get(key);
      if (stored && Date.now() - stored.storedAt < cacheTtlMs) return { data: stored.data, source: "cache" as const };
      throw error;
    }
  }

  app.get("/health", (_req, res) => void res.json({ status: "ok" }));
  app.use("/v1", requireKey);

  // The strict query schema drops the request if anything beyond skill, level, and format is sent.
  app.get("/v1/materials", async (req, res) => {
    const { skill_code, level, format } = catalogQuerySchema.parse(req.query);
    const params = { skill_code, level: String(level), ...(format ? { format } : {}) };
    res.json(
      await serve(`materials:${skill_code}:${level}:${format ?? ""}`, async () =>
        translateMaterials(await materials.get("/materials", params), (count) => log?.("acl_rejected", { provider: "materials", count })),
      ),
    );
  });

  app.get("/v1/activities", async (req, res) => {
    const { skill_code, level } = catalogQuerySchema.omit({ format: true }).parse(req.query);
    res.json(
      await serve(`activities:${skill_code}:${level}`, async () =>
        translateActivities(await activities.get("/activities", { skill_code, level: String(level) }), level, (count) => log?.("acl_rejected", { provider: "activities", count })),
      ),
    );
  });

  app.get("/v1/status", (_req, res) => {
    const view = (client: ProviderClient) => ({ name: client.options.name, lastSuccessAt: client.lastSuccessAt, lastError: client.lastError, rateLimitedUntil: client.rateLimitedUntil });
    res.json({ providers: [view(materials), view(activities)] });
  });

  const onError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof ZodError) return void res.status(400).json({ error: { code: "VALIDATION_ERROR" } });
    if (error instanceof ProviderError) return void res.status(STATUS_BY_CODE[error.code]).json({ error: { code: error.code } });
    log?.("unhandled_error", { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  };
  app.use(onError);
  return app;
}
