import prisma from "@kora/db";
import dotenv from "dotenv";
import path from "node:path";
import { AnalyticsService } from "../src/analytics/analytics.service";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

async function main() {
  const userId = "simulated-user-123";
  const analytics = new AnalyticsService();

  console.log(`🏋️ Starting workout simulation for user: ${userId}`);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { userSessions: true },
  });

  if (!user) {
    console.error("❌ User not found. Run simulate-setup.ts first.");
    return;
  }

  const sessions = await prisma.userSession.findMany({
    where: { userId },
    orderBy: [{ week: "asc" }, { dayNumber: "asc" }],
    take: 3,
  });

  if (sessions.length === 0) {
    console.error(
      "❌ No sessions found for user. Plan generation might have failed.",
    );
    return;
  }

  console.log(`Found ${sessions.length} sessions to simulate.`);

  // Day 1: Moderate intensity
  console.log("\n📆 Day 1 Simulation...");
  if (sessions[0]) await simulateSession(userId, sessions[0].id, 1.0); // 1.0 multiplier for weights

  // Day 2: Higher intensity (PR territory)
  console.log("\n📆 Day 2 Simulation (PR Weight)...");
  if (sessions[1]) await simulateSession(userId, sessions[1].id, 1.1); // 10% heavier

  // Day 3: High Volume (PR Volume)
  console.log("\n📆 Day 3 Simulation (PR Volume)...");
  if (sessions[2]) await simulateSession(userId, sessions[2].id, 0.9, 2); // Slightly lighter but 2x sets

  // Final Output
  console.log("\n📊 --- FINAL ANALYTICS REPORT ---");
  const stats = await analytics.getDashboardStats(userId);
  const prs = await analytics.getPersonalRecords(userId);

  console.log("\nDashboard Stats:", JSON.stringify(stats, null, 2));
  console.log(
    "\nPersonal Records:",
    JSON.stringify(
      prs.map((p: Record<string, any>) => ({
        exercise: p.exercise?.name || "Unknown",
        weight: p.maxWeightKg,
        volume: p.maxVolume,
        est1RM: p.estimated1RM,
      })),
      null,
      2,
    ),
  );
}

async function simulateSession(
  userId: string,
  sessionId: string,
  weightMult: number,
  setMult = 1,
) {
  const analytics = new AnalyticsService();
  const session = await prisma.userSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) return;

  const planned = session.planned as Record<string, any>;
  const startedAt = new Date();
  const completedAt = new Date(startedAt.getTime() + 45 * 60 * 1000); // 45 mins session

  // 1. Create Exercise Logs
  for (const ex of planned.exercises) {
    const sets = ex.sets * setMult;
    const weights = Array(sets).fill(
      Math.round((Number.parseInt(ex.intensity, 10) || 50) * weightMult),
    );
    const reps = Array(sets).fill(Number.parseInt(ex.reps, 10) || 10);

    await prisma.userExerciseLog.create({
      data: {
        sessionId,
        exerciseId: ex.exerciseId,
        actualSets: sets,
        plannedSets: ex.sets,
        plannedReps: ex.reps, // Added to fix type error
        weightsPerSet: weights,
        repsPerSet: reps,
      },
    });
  }

  // 2. Mark Session Complete
  await prisma.userSession.update({
    where: { id: sessionId },
    data: {
      completedStatus: true,
      startedAt,
      completedAt,
      totalDurationSeconds: 45 * 60,
      fatigue: 7, // Scale 1-10
    },
  });

  // 3. Trigger Analytics Engine
  await analytics.processSessionEngine(userId, sessionId);
  console.log(`✅ Session ${sessionId} processed successfully.`);
}

main().catch(console.error);
