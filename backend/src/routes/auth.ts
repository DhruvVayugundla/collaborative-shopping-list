import { Router, type Response } from "express";
import { prisma } from "../db.js";
import { AppError } from "../errors.js";
import { credentialsSchema } from "../validation.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { COOKIE_NAME, cookieMaxAgeMs, cookieOptions, signToken, type AuthUser } from "../auth/jwt.js";
import { currentUser, requireAuth } from "../auth/middleware.js";

export const authRouter = Router();

function setSession(res: Response, user: AuthUser) {
  res.cookie(COOKIE_NAME, signToken(user), { ...cookieOptions, maxAge: cookieMaxAgeMs });
}

const toUser = (u: { id: string; username: string; createdAt: Date }) => ({
  id: u.id,
  username: u.username,
  createdAt: u.createdAt.toISOString(),
});

authRouter.post("/register", async (req, res) => {
  const { username, password } = credentialsSchema.parse(req.body);
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) throw new AppError("CONFLICT", "That username is already taken");

  const user = await prisma.user.create({
    data: { username, passwordHash: await hashPassword(password) },
  });
  setSession(res, user);
  res.status(201).json({ user: toUser(user) });
});

authRouter.post("/login", async (req, res) => {
  const { username, password } = credentialsSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new AppError("UNAUTHENTICATED", "Invalid username or password");
  }
  setSession(res, user);
  res.json({ user: toUser(user) });
});

// Doesn't require a valid session, so an expired cookie can still be cleared.
authRouter.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: currentUser(req).id } });
  if (!user) {
    res.clearCookie(COOKIE_NAME, cookieOptions);
    throw new AppError("UNAUTHENTICATED", "Please log in");
  }
  res.json({ user: toUser(user) });
});
