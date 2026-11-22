import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { caregiverRouter, saveSessionSummary } from "./contexts/caregiver/routes";
import { identityRouter } from "./contexts/identity/routes";
import { onSessionCompleted } from "./contexts/learning/events";
import { learningRouter } from "./contexts/learning/routes";
import { profileRouter } from "./contexts/profile/routes";
import { integrationRouter } from "./integrations/routes";
import { config } from "./lib/config";
import { AppError, errorHandler } from "./lib/errors";
import { log } from "./lib/logger";
import { prisma } from "./lib/prisma";

onSessionCompleted(saveSessionSummary);

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.TRUST_PROXY_HOPS);
  app.use(
    helmet({
      hsts: config.COOKIE_SECURE,
      contentSecurityPolicy: {
        directives: {
          // The STB may serve plain HTTP on a local network.
          upgradeInsecureRequests: null,
          imgSrc: ["'self'", "data:", "https:"],
          mediaSrc: ["'self'", "data:", "https:"],
        },
      },
    }),
  );
  if (config.WEB_ORIGIN) {
    app.use("/api", (req, res, next) => {
      res.vary("Origin");
      if (req.get("Origin") !== config.WEB_ORIGIN) return next();
      res.set({
        "Access-Control-Allow-Origin": config.WEB_ORIGIN,
        "Access-Control-Allow-Credentials": "true",
      });
      if (req.method !== "OPTIONS" || !req.get("Access-Control-Request-Method")) return next();
      res.set({
        "Access-Control-Allow-Methods": "GET, POST, PATCH",
        "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key, X-API-Key",
      });
      res.sendStatus(204);
    });
  }
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());
  app.use("/api", (req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => log("info", "http_request", { method: req.method, path: req.baseUrl + req.path, status: res.statusCode, durationMs: Date.now() - startedAt }));
    next();
  });

  app.get("/api/health", async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  });
  app.use("/api", identityRouter, profileRouter, learningRouter, caregiverRouter, integrationRouter);
  app.use("/api", () => {
    throw new AppError(404, "NOT_FOUND", "Resource not found");
  });

  const webDist = resolve(config.WEB_DIST);
  if (existsSync(join(webDist, "index.html"))) {
    app.use(express.static(webDist));
    app.get("/{*path}", (_req, res) => res.sendFile(join(webDist, "index.html")));
  }
  app.use(errorHandler);
  return app;
}
