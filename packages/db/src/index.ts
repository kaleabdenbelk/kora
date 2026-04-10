import { env } from "@kora/env/server";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../prisma/generated/client";

export { PrismaClient } from "../prisma/generated/client";

import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl:
    env.DATABASE_URL.includes("amazonaws.com") ||
    env.DATABASE_URL.includes("heroku")
      ? { rejectUnauthorized: false }
      : false,
});

const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

export * from "../prisma/generated/enums";
export default prisma;
