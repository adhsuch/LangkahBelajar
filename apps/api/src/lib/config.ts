import { z } from "zod";

export const config = z
  .object({
    NODE_ENV: z.string().default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1),
    COOKIE_SECURE: z.stringbool().default(false),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
    SESSION_TTL_HOURS: z.coerce.number().positive().default(168),
    INTEGRATION_URL: z.url(),
    INTEGRATION_API_KEY: z.string().min(1),
    INTEGRATION_TIMEOUT_MS: z.coerce.number().int().positive().default(4000),
    CATALOG_CACHE_TTL_HOURS: z.coerce.number().positive().default(168),
    WEB_DIST: z.string().default("../web/dist"),
  })
  .parse(process.env);
