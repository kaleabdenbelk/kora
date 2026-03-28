import prisma from "@kora/db";
import { PlanService } from "../../../packages/api/src/services/plan.service";
import { AnalyticsService } from "../src/analytics/analytics.service";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

async function main() {
  console.log("Checking database connection...");
  try {
    await prisma.$connect();
    console.log("✅ Database connected.");
  } catch (e) {
    console.error("❌ Database connection failed:", e);
    process.exit(1);
  }

  const userId = "simulated-user-123";
  const email = "sim@kora.app";

  console.log(`🚀 Starting simulation for user: ${userId}`);

  // 1. Cleanup existing simulated user
  await prisma.user.deleteMany({ where: { id: userId } });

  // 2. Create User
  await prisma.user.create({
    data: {
      id: userId,
      email,
      name: "Simulated User",
      role: "user",
    },
  });
  console.log("✅ User created.");

  // 3. Complete Onboarding
  await prisma.onboarding.create({
    data: {
      userId,
      weight: 80,
      height: 180,
      age: 25,
      gender: "MALE",
      goal: "HYPERTROPHY",
      trainingLevel: "BEGINNER",
      trainingDaysPerWeek: 3,
      activityLevel: "MODERATELY_ACTIVE",
    },
  });
  console.log("✅ Onboarding data inserted.");

  // 4. Calculate Metabolic Rates
  const analytics = new AnalyticsService();
  const rates = await analytics.recalculateAndSaveMetabolicRates(userId);
  console.log("✅ Metabolic rates calculated:", rates);

  // 5. Generate Plan
  const planService = new PlanService();
  try {
    await planService.generatePlan(userId);
    console.log("✅ Plan generated.");
  } catch (e: any) {
    console.warn("⚠️ Plan generation failed (no match), falling back to first program...");
    const program = await prisma.program.findFirst();
    if (program) {
      // Manual creation if service fails (using a simplified version of generatePlan logic)
      const startDate = new Date();
      const userPlan = await prisma.userPlan.create({
        data: {
          userId,
          programId: program.id,
          startDate,
        }
      });
      // We also need sessions for the engine
      await prisma.userSession.create({
        data: {
          userId,
          planId: userPlan.id, // Fixed: Added planId
          dayNumber: 1,
          week: 1,
          planned: { name: "Manual Session", exercises: [] }
        }
      });
      console.log("✅ Fallback plan created.");
    } else {
      console.error("❌ No programs in database. Run seed first.");
    }
  }

  console.log("\nSetup complete. Now run: npx tsx scripts/simulate-workouts.ts");
}

main().catch(console.error);
