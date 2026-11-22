import { accountUpdateSchema, loginSchema, passwordChangeSchema, registerSchema } from "@langkahbelajar/shared";
import { Router, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { config } from "../../lib/config";
import { AppError } from "../../lib/errors";
import { isUniqueViolation, prisma } from "../../lib/prisma";
import { currentUser, requireAuth, SESSION_COOKIE } from "./access";
import { hashPassword, hashToken, newToken, verifyPassword } from "./passwords";

export const identityRouter = Router();

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.AUTH_RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many attempts, please try again later" } },
});

const cookieOptions = { httpOnly: true, sameSite: "strict", secure: config.COOKIE_SECURE, path: "/" } as const;
const ttlMs = config.SESSION_TTL_HOURS * 60 * 60 * 1000;

async function startSession(res: Response, userId: string) {
  const token = newToken();
  await prisma.authSession.create({ data: { tokenHash: hashToken(token), userId, expiresAt: new Date(Date.now() + ttlMs) } });
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: ttlMs });
}

const publicUser = (user: { id: string; email: string; displayName: string }) => ({ id: user.id, email: user.email, displayName: user.displayName });

identityRouter.post("/auth/register", authLimiter, async (req, res) => {
  const input = registerSchema.parse(req.body);
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await prisma.user.create({ data: { email: input.email, displayName: input.displayName, passwordHash } });
    await startSession(res, user.id);
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError(409, "EMAIL_TAKEN", "This email is already registered");
    throw error;
  }
});

// Verifying against a dummy hash keeps response time similar for unknown emails.
const dummyHash = hashPassword("not-a-real-password");

identityRouter.post("/auth/login", authLimiter, async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const valid = await verifyPassword(input.password, user?.passwordHash ?? (await dummyHash));
  if (!user || !valid) throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  await startSession(res, user.id);
  res.json({ user: publicUser(user) });
});

identityRouter.post("/auth/logout", requireAuth, async (req, res) => {
  await prisma.authSession.delete({ where: { id: req.authSessionId } });
  res.clearCookie(SESSION_COOKIE, cookieOptions);
  res.status(204).end();
});

identityRouter.get("/auth/me", requireAuth, (req, res) => {
  res.json({ user: currentUser(req) });
});

identityRouter.patch("/auth/me", requireAuth, async (req, res) => {
  const input = accountUpdateSchema.parse(req.body);
  const user = await prisma.user.update({ where: { id: currentUser(req).id }, data: input });
  res.json({ user: publicUser(user) });
});

identityRouter.post("/auth/password", authLimiter, requireAuth, async (req, res) => {
  const input = passwordChangeSchema.parse(req.body);
  const userId = currentUser(req).id;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new AppError(400, "INVALID_CURRENT_PASSWORD", "Current password is incorrect");
  }
  const passwordHash = await hashPassword(input.newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.authSession.deleteMany({ where: { userId, id: { not: req.authSessionId } } }),
  ]);
  res.status(204).end();
});
