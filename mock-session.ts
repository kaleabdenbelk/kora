import { PrismaClient } from "./packages/db/prisma/generated/client";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const prisma = new PrismaClient();

async function createMockSession() {
  console.log("🚀 Creating Mock Completed Session...");

  const user = await prisma.user.findFirst();
  if (!user) {
    console.error("❌ No user found. Please sign in to the app first.");
    return;
  }
  console.log(`👤 Found User: ${user.name} (ID: ${user.id})`);

  let plan = await prisma.userPlan.findFirst({
    where: { userId: user.id, isActive: true, isDeleted: false },
  });

  if (!plan) {
    console.log("📝 Creating a dummy plan for the user...");
    plan = await prisma.userPlan.create({
      data: {
        userId: user.id,
        name: "Mock Growth Plan",
        startDate: new Date(),
        isActive: true,
        source: "CUSTOM",
        planJson: {},
      },
    });
  }

  console.log("🏋️ Creating a completed session started today...");
  const session = await prisma.userSession.create({
    data: {
      userId: user.id,
      planId: plan.id,
      dayNumber: 1,
      week: 1,
      planned: {},
      startedAt: new Date(Date.now() - 3600000), 
      completedAt: new Date(),
      completedStatus: true,
      totalVolumeKg: 5000,
      totalDurationSeconds: 2700,
      activeMinutes: 45,
    },
  });

  console.log("📊 Adding exercise logs...");
  await prisma.userExerciseLog.create({
    data: {
      sessionId: session.id,
      exerciseId: "1", 
      plannedSets: 3,
      plannedReps: "5",
      actualSets: 3,
      completed: true,
      weightsPerSet: [100, 100, 100],
      repsPerSet: [5, 5, 5],
    },
  });

  await prisma.userExerciseLog.create({
    data: {
      sessionId: session.id,
      exerciseId: "2", 
      plannedSets: 3,
      plannedReps: "10",
      actualSets: 3,
      completed: true,
      weightsPerSet: [60, 60, 60],
      repsPerSet: [10, 10, 10],
    },
  });

  console.log(`✅ SUCCESS: Mock session created (ID: ${session.id})`);
}

createMockSession()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
