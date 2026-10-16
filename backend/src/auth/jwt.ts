import jwt from "jsonwebtoken";
import type { CookieOptions } from "express";
import { config, isProd } from "../config.js";

export const COOKIE_NAME = "token";
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export interface AuthUser {
  id: string;
  username: string;
}

export function signToken(user: AuthUser) {
  return jwt.sign({ username: user.username }, config.JWT_SECRET, {
    subject: user.id,
    expiresIn: MAX_AGE_SECONDS,
  });
}

/** Returns the user encoded in the token, or null if it is missing, expired or tampered with. */
export function verifyToken(token: string | undefined): AuthUser | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as jwt.JwtPayload;
    if (!payload.sub || typeof payload.username !== "string") return null;
    return { id: payload.sub, username: payload.username };
  } catch {
    return null;
  }
}

export const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProd,
  path: "/",
};

export const cookieMaxAgeMs = MAX_AGE_SECONDS * 1000;
