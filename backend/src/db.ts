import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { config } from "./config.js";

// Turso in production (no persistent disk on the host); the local SQLite file everywhere else.
export const prisma = config.TURSO_DATABASE_URL
  ? new PrismaClient({
      adapter: new PrismaLibSQL({ url: config.TURSO_DATABASE_URL, authToken: config.TURSO_AUTH_TOKEN }),
    })
  : new PrismaClient();
