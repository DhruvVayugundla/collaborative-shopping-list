import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const config = schema.parse(process.env);
export const isProd = config.NODE_ENV === "production";
