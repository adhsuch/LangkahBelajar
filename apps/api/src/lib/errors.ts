import type { ErrorRequestHandler } from "express";
import { z, ZodError } from "zod";
import { log } from "./logger";

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = () => new AppError(404, "NOT_FOUND", "Resource not found");

// Unknown and foreign IDs both return 404, so the API never confirms that another family's record exists.
export function parseId(value: unknown) {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw notFound();
  return parsed.data;
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Invalid input", fields: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) },
    });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error?.type === "entity.parse.failed" || error?.type === "entity.too.large") {
    res.status(error.status).json({ error: { code: "INVALID_BODY", message: "Invalid request body" } });
    return;
  }
  log("error", "unhandled_error", { method: req.method, path: req.path, error: error instanceof Error ? error.message : String(error) });
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
};
