import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve("../../../.env") });

async function main() {
  console.log("🔍 Checking for data in drifting tables...");
  const prisma = new PrismaClient();
  try {
    console.log("📡 Connecting to database...");
    const caloricLogsCount = await prisma.dailyCaloricLog.count();
    const personalRecordsCount = await prisma.personalRecord.count();
    console.log(`daily_caloric_logs count: ${caloricLogsCount}`);
    console.log(`personal_records count: ${personalRecordsCount}`);
  } catch (e) {
    console.error("Error checking counts:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
