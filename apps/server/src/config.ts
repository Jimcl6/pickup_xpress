import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SESSION_DAYS: z.coerce.number().int().min(1).max(30).default(7)
});

export const config = envSchema.parse(process.env);
