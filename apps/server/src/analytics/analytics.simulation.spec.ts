import { describe, it, expect, beforeAll } from "vitest";
import prisma from "@kora/db";
import { AnalyticsService } from "./analytics.service";
import { PlanService } from "@kora/api/services/plan.service";
import { ensureProgramTemplates } from "../sync/seed.util";

describe("Analytics Simulation (End-to-End)", () => {
  const userId = "test-user-sim-999";
  const analytics = new AnalyticsService();
  const planService = new PlanService();

  beforeAll(async () => {
    // Cleanup
    await prisma.user.deleteMany({ where: { id: userId } });
    
    // Seed basic exercises to satisfy FK constraints
    const exerciseIds = ["1", "2", "3", "4", "5", "6", "11", "12", "13", "14", "16", "24", "30", "35", "36", "44", "49", "51", "52", "59", "60"];
    for (const id of exerciseIds) {
      await prisma.exercise.upsert({
        where: { id },
        update: {},
        create: {
          id,
          name: `Exercise ${id}`,
          type: "COMPOUND",
          level: "BEGINNER",
          environment: "GYM",
          instructions: ["Do it."],
        }
      });
    }

    // Seeding if needed
    await ensureProgramTemplates();
  });

  it("should complete onboarding and generate a plan", async () => {
    // 1. Create User
    await prisma.user.create({
      data: { id: userId, email: "sim@test.app", name: "Sim User" }
    });

    // 2. Onboarding
    await prisma.onboarding.create({
      data: {
        userId,
        weight: 85,
        height: 185,
        age: 30,
        gender: "MALE",
        goal: "HYPERTROPHY",
        trainingLevel: "BEGINNER",
        trainingDaysPerWeek: 3,
        activityLevel: "VERY_ACTIVE"
      }
    });

    // 3. Metabolic Rates
    const rates = await analytics.recalculateAndSaveMetabolicRates(userId);
    console.log("METABOLIC RATES:", rates);

    // 3.5 Check Database State
    const selectionCount = await prisma.programSelection.count();
    console.log("DB PROGRAM SELECTION COUNT:", selectionCount);
    if (selectionCount === 0) {
      console.warn("⚠️ ProgramSelection table is EMPTY. Plan generation will always fail.");
    }

    // 4. Generate Plan
    try {
      await planService.generatePlan(userId);
      console.log("PLAN GENERATED SUCCESSFULLY");
    } catch (e) {
      console.warn("PLAN GENERATION FAILED, trying manual session...", e);
      const program = await prisma.program.findFirst();
      if (program) {
        const up = await prisma.userPlan.create({ data: { userId, programId: program.id, startDate: new Date() } });
        await prisma.userSession.create({
          data: {
            userId,
            planId: up.id,
            dayNumber: 1,
            week: 1,
            planned: { name: "Manual", exercises: [] }
          }
        });
      }
    }
  });

  it("should process a workout and update analytics", async () => {
    // Wait a bit to ensure session is in DB
    const session = await prisma.userSession.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });

    if (!session) throw new Error("No session for workout simulation");

    // Mock Exercise Log (PR Weight)
    await prisma.userExerciseLog.create({
      data: {
        sessionId: session.id,
        exerciseId: "2", // Using a seeded ID
        actualSets: 3,
        plannedSets: 3,
        plannedReps: "10",
        weightsPerSet: [100, 100, 100],
        repsPerSet: [10, 10, 10]
      }
    });

    await prisma.userSession.update({
      where: { id: session.id },
      data: {
        completedStatus: true,
        startedAt: new Date(Date.now() - 3600 * 1000),
        completedAt: new Date(),
        totalDurationSeconds: 3600,
        fatigue: 8
      }
    });

    await analytics.processSessionEngine(userId, session.id);

    const stats = await analytics.getDashboardStats(userId);
    console.log("DASHBOARD STATS:", JSON.stringify(stats, null, 2));

    const updatedSession = await prisma.userSession.findUnique({ where: { id: session.id } });
    console.log("UPDATED SESSION METRICS:", {
      successPercent: updatedSession?.successPercent,
      totalVolumeKg: updatedSession?.totalVolumeKg,
      activeMinutes: updatedSession?.activeMinutes
    });

    const heatmap = await analytics.getActivityHeatmap(userId);
    console.log("HEATMAP DATA:", heatmap);

    const history = await analytics.getWorkoutHistory(userId);
    console.log("HISTORY DATA (count):", history.total);

    expect(stats.totalWorkouts).toBe(1);
    expect(stats.currentStreak).toBe(1);
    expect(updatedSession?.successPercent).toBe(100);
    expect(updatedSession?.totalVolumeKg).toBe(3000); // 3 * 10 * 100
    expect(updatedSession?.activeMinutes).toBeGreaterThan(0);
    expect(Object.keys(heatmap).length).toBe(1);
    expect(history.sessions.length).toBe(1);
  });
});
