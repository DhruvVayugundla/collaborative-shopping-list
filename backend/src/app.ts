import fs from "node:fs";
import path from "node:path";
import express, { Router } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { config, isProd } from "./config.js";
import { AppError, errorBody, errorHandler } from "./errors.js";
import { requireAuth } from "./auth/middleware.js";
import { authRouter } from "./routes/auth.js";
import { listsRouter } from "./routes/lists.js";
import { membersRouter } from "./routes/members.js";
import { itemsRouter } from "./routes/items.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => config.NODE_ENV === "test",
    handler: (_req, res) => {
      res.status(429).json(errorBody("RATE_LIMITED", "Too many attempts, please try again later"));
    },
  });

  const api = Router();
  api.get("/health", (_req, res) => {
    res.json({ ok: true });
  });
  api.use("/auth", authLimiter, authRouter);
  api.use("/lists", requireAuth, listsRouter);
  api.use("/lists/:listId/members", requireAuth, membersRouter);
  api.use("/lists/:listId/items", requireAuth, itemsRouter);
  api.use((_req, _res, next) => next(new AppError("NOT_FOUND", "Route not found")));

  app.use("/api/v1", api);

  // In production the API also serves the built frontend (single deployable service).
  const webDist = path.resolve(import.meta.dirname, "../../frontend/dist");
  if (isProd && fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
      res.sendFile(path.join(webDist, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}
