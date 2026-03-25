import { z } from "zod";
import { protectedProcedure, rateLimitedProcedure, router } from "../index";
import prisma, { Gender, ExperienceLevel, ExerciseEnvironment, DayOfWeek, TrainingGoal } from "@kora/db";
import { PlanService } from "../services/plan.service";

const planService = new PlanService();

const onboardingSchema = z.object({
  preferredName: z.string().optional(),
  gender: z.nativeEnum(Gender).optional(),
  age: z.number().int().min(13).max(120).optional(),
  weight: z.number().positive().optional(),
  targetWeight: z.number().positive().optional(),
  height: z.number().positive().optional(),
  bmi: z.number().positive().optional(),
  sleepHours: z.number().min(0).max(24).optional(),
  waterDaily: z.number().nonnegative().optional(),
  trainingLevel: z.nativeEnum(ExperienceLevel).optional(),
  trainingEnvironment: z.nativeEnum(ExerciseEnvironment).optional(),
  trainingDaysPerWeek: z.number().int().min(1).max(7).optional(),
  workoutDays: z.array(z.nativeEnum(DayOfWeek)).optional(),
  goal: z.nativeEnum(TrainingGoal).optional(),
});

export const onboardingRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const onboarding = await prisma.onboarding.findUnique({
      where: { userId: ctx.session.user.id },
    });
    return onboarding;
  }),

  // Protect onboarding updates (e.g., max 10 requests per minute)
  update: rateLimitedProcedure(60000, 10, "onboarding:update")
    .input(onboardingSchema)
    .mutation(async ({ ctx, input }) => {
      const onboarding = await prisma.onboarding.upsert({
        where: { userId: ctx.session.user.id },
        update: input,
        create: {
          ...input,
          userId: ctx.session.user.id,
        },
      });

      // Trigger plan generation if profile is complete
      if (onboarding.goal && onboarding.trainingLevel && onboarding.trainingDaysPerWeek && onboarding.gender) {
        try {
          await planService.generatePlan(ctx.session.user.id);
        } catch (error) {
          console.error("Failed to generate plan on onboarding completion:", error);
          // We don't throw here to avoid failing the onboarding update itself
        }
      }

      return onboarding;
    }),
});
