import type { Request, RequestHandler } from "express";
import { AppError, notFound, parseId } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { hashToken } from "./passwords";

export const SESSION_COOKIE = "lb_session";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
    authSessionId?: string;
  }
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  const session =
    typeof token === "string"
      ? await prisma.authSession.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } })
      : null;
  if (!session || session.expiresAt <= new Date()) throw new AppError(401, "UNAUTHENTICATED", "Please sign in");
  req.user = { id: session.user.id, email: session.user.email, displayName: session.user.displayName };
  req.authSessionId = session.id;
  next();
};

export function currentUser(req: Request) {
  if (!req.user) throw new AppError(401, "UNAUTHENTICATED", "Please sign in");
  return req.user;
}

export async function assertChildAccess(userId: string, childId: string) {
  const relation = await prisma.caregiverChildRelation.findUnique({ where: { caregiverId_childId: { caregiverId: userId, childId } } });
  if (!relation) throw notFound();
  return relation;
}

/** Authorizes the caregiver for `:id` and returns the validated child ID. */
export async function authorizedChildId(req: Request) {
  const childId = parseId(req.params.id);
  await assertChildAccess(currentUser(req).id, childId);
  return childId;
}

export function requireApiScope(scope: string): RequestHandler {
  return async (req, _res, next) => {
    const key = req.get("x-api-key");
    const client = key ? await prisma.apiClient.findUnique({ where: { keyHash: hashToken(key) } }) : null;
    if (!client?.active) throw new AppError(401, "INVALID_API_KEY", "A valid API key is required");
    if (!client.scopes.includes(scope)) throw new AppError(403, "INSUFFICIENT_SCOPE", `Scope ${scope} is required`);
    next();
  };
}
