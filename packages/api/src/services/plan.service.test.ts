import { describe, it, expect, beforeAll } from 'vitest';
import prisma, { Gender, ExperienceLevel, TrainingGoal } from "@kora/db";
import { PlanService } from "./plan.service";

describe('PlanService', () => {
  const planService = new PlanService();
  const testUserId = "test-user-plan-gen";

  beforeAll(async () => {
    // 1. Create a test user if not exists
    await prisma.user.upsert({
      where: { id: testUserId },
      update: {},
      create: {
        id: testUserId,
        name: "Test User",
        email: "test-plan-gen@example.com",
      },
    });

    // 2. Clear previous onboarding and plans for this user
    await prisma.userPlan.deleteMany({ where: { userId: testUserId } });
    await prisma.onboarding.deleteMany({ where: { userId: testUserId } });
  });

  it('should generate a plan when onboarding is complete (including gender)', async () => {
    // 3. Create onboarding data with required fields
    await prisma.onboarding.create({
      data: {
        userId: testUserId,
        goal: TrainingGoal.HYPERTROPHY,
        trainingLevel: ExperienceLevel.BEGINNER,
        trainingDaysPerWeek: 3,
        gender: Gender.MALE,
      },
    });

    // 4. Trigger plan generation
    const plan = await planService.generatePlan(testUserId);
    expect(plan).toBeDefined();
    expect(plan.id).toBeDefined();

    // 5. Verify UserSessions were created
    const sessionsCount = await prisma.userSession.count({
      where: { planId: plan.id },
    });
    expect(sessionsCount).toBeGreaterThan(0);
  });
});
