import { z } from "zod";
import { createIntegrationApp } from "./app";
import { ProviderClient } from "./provider-client";

const env = z
  .object({
    PORT: z.coerce.number().int().positive().default(4100),
    INTEGRATION_API_KEY: z.string().min(1),
    MATERIAL_PROVIDER_URL: z.url(),
    ACTIVITY_PROVIDER_URL: z.url(),
    MATERIAL_PROVIDER_API_KEY: z.string().optional(),
    ACTIVITY_PROVIDER_API_KEY: z.string().optional(),
    PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(2500),
    PROVIDER_RETRIES: z.coerce.number().int().min(0).max(3).default(1),
    CACHE_TTL_MINUTES: z.coerce.number().positive().default(60),
  })
  .parse(process.env);

const log = (event: string, fields: Record<string, unknown>) =>
  console.log(JSON.stringify({ time: new Date().toISOString(), service: "integration", event, ...fields }));

const client = (name: string, baseUrl: string, apiKey?: string) =>
  new ProviderClient({ name, baseUrl, apiKey: apiKey || undefined, timeoutMs: env.PROVIDER_TIMEOUT_MS, retries: env.PROVIDER_RETRIES, log });

createIntegrationApp({
  apiKey: env.INTEGRATION_API_KEY,
  materials: client("material-provider", env.MATERIAL_PROVIDER_URL, env.MATERIAL_PROVIDER_API_KEY),
  activities: client("activity-provider", env.ACTIVITY_PROVIDER_URL, env.ACTIVITY_PROVIDER_API_KEY),
  cacheTtlMs: env.CACHE_TTL_MINUTES * 60 * 1000,
  log,
}).listen(env.PORT, () => log("server_started", { port: env.PORT }));
