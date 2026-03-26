import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../../.env") });

import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    AWS_S3_ENDPOINT: z.string().url().optional(),
    AWS_S3_ACCESS_KEY_ID: z.string().min(1),
    AWS_S3_SECRET_ACCESS_KEY: z.string().min(1),
    AWS_S3_BUCKET_NAME: z.string().min(1),
    AWS_S3_REGION: z.string().min(1),
    REDIS_HOST: z.string().default("localhost"),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_PASSWORD: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
