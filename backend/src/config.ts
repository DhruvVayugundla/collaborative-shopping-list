import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Optional: enables AI quick-add. Without it the feature is hidden.
  GROQ_API_KEY: z.string().min(1).optional(),
  // Must support Groq strict structured outputs (e.g. openai/gpt-oss-120b, openai/gpt-oss-20b).
  GROQ_MODEL: z.string().min(1).default("openai/gpt-oss-120b"),
});

export const config = schema.parse(process.env);
export const isProd = config.NODE_ENV === "production";
