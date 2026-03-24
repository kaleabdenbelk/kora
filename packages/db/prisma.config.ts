import path from "node:path";
import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

dotenv.config({
  path: path.resolve(import.meta.dirname, "../../.env"),
});

export default defineConfig({
  schema: path.resolve(import.meta.dirname, "prisma/schema"),

  migrations: {
    path: path.resolve(import.meta.dirname, "prisma/migrations"),
  },

  datasource: {
    url: env("DATABASE_URL"),
  },
});
