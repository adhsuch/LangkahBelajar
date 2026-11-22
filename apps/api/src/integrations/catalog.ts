import { activitySchema, catalogResponseSchema, materialSchema, type Activity, type Material, type MaterialFormat, type SkillCode } from "@langkahbelajar/shared";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { config } from "../lib/config";
import { log } from "../lib/logger";
import { prisma } from "../lib/prisma";

export interface CatalogResult<T> {
  items: T[];
  source: "live" | "cache";
  degraded: boolean;
  reason?: string;
}

class IntegrationError extends Error {
  constructor(
    readonly code: string,
    readonly httpStatus?: number,
  ) {
    super(code);
  }
}

async function recordCall(provider: string, outcome: string, startedAt: number, httpStatus?: number, errorCode?: string) {
  const durationMs = Date.now() - startedAt;
  log(outcome === "ERROR" ? "warn" : "info", "integration_call", { provider, outcome, httpStatus, durationMs, errorCode });
  // Logging must never turn a usable fallback into a failed request.
  await prisma.externalProviderLog.create({ data: { provider, operation: "list", outcome, httpStatus, durationMs, errorCode } }).catch(() => undefined);
}

/** Query is limited to skill code, level, and format by this signature. Child data cannot reach this call. */
async function fetchCatalog<T extends z.ZodType>(provider: "materials" | "activities", item: T, skillCode: SkillCode, level: number, format?: MaterialFormat) {
  const url = new URL(`/v1/${provider}`, config.INTEGRATION_URL);
  url.searchParams.set("skill_code", skillCode);
  url.searchParams.set("level", String(level));
  if (format) url.searchParams.set("format", format);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { headers: { "x-api-key": config.INTEGRATION_API_KEY }, signal: AbortSignal.timeout(config.INTEGRATION_TIMEOUT_MS) });
    if (!response.ok) throw new IntegrationError(response.status === 429 ? "RATE_LIMITED" : "UPSTREAM_ERROR", response.status);
    const parsed = catalogResponseSchema(item).safeParse(await response.json());
    if (!parsed.success) throw new IntegrationError("INVALID_RESPONSE", response.status);
    await recordCall(provider, parsed.data.source === "live" ? "OK" : "UPSTREAM_CACHE", startedAt, response.status);
    return parsed.data;
  } catch (error) {
    const code = error instanceof IntegrationError ? error.code : error instanceof DOMException && error.name === "TimeoutError" ? "TIMEOUT" : "UNREACHABLE";
    await recordCall(provider, "ERROR", startedAt, error instanceof IntegrationError ? error.httpStatus : undefined, code);
    throw new IntegrationError(code);
  }
}

const validUntil = (now: Date) => new Date(now.getTime() + config.CATALOG_CACHE_TTL_HOURS * 60 * 60 * 1000);

// Stored rows can hold several versions, so only the newest version of each item is served.
function latestPerId<T>(rows: T[], idOf: (row: T) => string) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const id = idOf(row);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

async function storeMaterials(items: Material[]) {
  const now = new Date();
  for (const item of items) {
    const data = { skillCode: item.skillCode, level: item.level, format: item.format, mediaUrl: item.mediaUrl, title: item.title, fetchedAt: now, validUntil: validUntil(now) };
    await prisma.materialCache.upsert({ where: { materialId_version: { materialId: item.materialId, version: item.version } }, create: { materialId: item.materialId, version: item.version, ...data }, update: data });
  }
}

async function storeActivities(items: Activity[]) {
  const now = new Date();
  for (const item of items) {
    const data = { skillCode: item.skillCode, level: item.level, template: item as unknown as Prisma.InputJsonValue, fetchedAt: now, validUntil: validUntil(now) };
    await prisma.activityCache.upsert({ where: { activityId_version: { activityId: item.activityId, version: item.version } }, create: { activityId: item.activityId, version: item.version, ...data }, update: data });
  }
}

export async function storedMaterials(where: Prisma.MaterialCacheWhereInput = {}): Promise<Material[]> {
  const rows = await prisma.materialCache.findMany({ where: { ...where, validUntil: { gt: new Date() } }, orderBy: [{ fetchedAt: "desc" }, { version: "desc" }] });
  return latestPerId(rows, (row) => row.materialId).map((row) => materialSchema.parse({ ...row, skillCode: row.skillCode, format: row.format }));
}

async function storedActivities(skillCode: SkillCode, level: number): Promise<Activity[]> {
  const rows = await prisma.activityCache.findMany({ where: { skillCode, level, validUntil: { gt: new Date() } }, orderBy: [{ fetchedAt: "desc" }, { version: "desc" }] });
  return latestPerId(rows, (row) => row.activityId).map((row) => activitySchema.parse(row.template));
}

async function withFallback<T>(live: () => Promise<{ data: T[]; source: "live" | "cache" }>, store: (items: T[]) => Promise<void>, stored: () => Promise<T[]>): Promise<CatalogResult<T>> {
  let reason = "EMPTY";
  try {
    const response = await live();
    if (response.data.length > 0) {
      if (response.source === "live") await store(response.data);
      return { items: response.data, source: response.source, degraded: response.source === "cache" };
    }
  } catch (error) {
    reason = error instanceof IntegrationError ? error.code : "UNREACHABLE";
  }
  return { items: await stored(), source: "cache", degraded: true, reason };
}

export const getMaterials = (skillCode: SkillCode, level: number, format?: MaterialFormat) =>
  withFallback(
    () => fetchCatalog("materials", materialSchema, skillCode, level, format),
    storeMaterials,
    () => storedMaterials({ skillCode, level, ...(format ? { format } : {}) }),
  );

export const getActivities = (skillCode: SkillCode, level: number) =>
  withFallback(
    () => fetchCatalog("activities", activitySchema, skillCode, level),
    storeActivities,
    () => storedActivities(skillCode, level),
  );

export async function integrationStatus() {
  let integration: { reachable: boolean; providers?: unknown } = { reachable: false };
  try {
    const response = await fetch(new URL("/v1/status", config.INTEGRATION_URL), { headers: { "x-api-key": config.INTEGRATION_API_KEY }, signal: AbortSignal.timeout(config.INTEGRATION_TIMEOUT_MS) });
    if (response.ok) integration = { reachable: true, ...(z.object({ providers: z.unknown() }).parse(await response.json())) };
  } catch {
    // An unreachable service is the state being reported.
  }
  const now = new Date();
  const [materials, activities, lastCalls] = await Promise.all([
    prisma.materialCache.count({ where: { validUntil: { gt: now } } }),
    prisma.activityCache.count({ where: { validUntil: { gt: now } } }),
    prisma.externalProviderLog.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { provider: true, outcome: true, errorCode: true, durationMs: true, createdAt: true } }),
  ]);
  return { integration, storedItems: { materials, activities }, lastCalls };
}
