import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL";

const statusByCode: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
  }

  get status() {
    return statusByCode[this.code];
  }
}

export function errorBody(code: ErrorCode, message: string, details: Record<string, unknown> = {}) {
  return { error: { code, message, details } };
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json(errorBody(err.code, err.message, err.details));
    return;
  }
  if (err instanceof ZodError) {
    const issues = err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    res.status(400).json(errorBody("VALIDATION_ERROR", issues[0]?.message ?? "Invalid input", { issues }));
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    res.status(409).json(errorBody("CONFLICT", "Resource already exists"));
    return;
  }
  // Malformed JSON body from express.json()
  if (err?.type === "entity.parse.failed") {
    res.status(400).json(errorBody("VALIDATION_ERROR", "Malformed JSON body"));
    return;
  }
  console.error(err);
  res.status(500).json(errorBody("INTERNAL", "Something went wrong"));
};
