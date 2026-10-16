import type { Request, RequestHandler } from "express";
import { AppError } from "../errors.js";
import { COOKIE_NAME, verifyToken, type AuthUser } from "./jwt.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const user = verifyToken(req.cookies?.[COOKIE_NAME]);
  if (!user) return next(new AppError("UNAUTHENTICATED", "Please log in"));
  req.user = user;
  next();
};

/** For handlers mounted behind requireAuth. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new AppError("UNAUTHENTICATED", "Please log in");
  return req.user;
}
