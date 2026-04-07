import prisma, {
  DayOfWeek,
  ExerciseEnvironment,
  ExperienceLevel,
  Gender,
  TrainingGoal,
} from "@kora/db";
import { z } from "zod";
import { protectedProcedure, rateLimitedProcedure, router } from "../index";
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
  get: protectedProcedure
    .output(z.any())
    .query(async ({ ctx }) => {
      console.log(
        `[ONBOARDING] Fetching onboarding for user: ${ctx.session.user.id}`,
      );
      const onboarding = await prisma.onboarding.findUnique({
        where: { userId: ctx.session.user.id },
      });
      console.log(`[ONBOARDING] Onboarding found: ${!!onboarding}`);
      return onboarding;
    }),

  // Protect onboarding updates (e.g., max 10 requests per minute)
  update: rateLimitedProcedure(60000, 10, "onboarding:update", false)
    .input(onboardingSchema)
    .output(z.any())
    .mutation(async ({ ctx, input }) => {
      console.log(
        `[ONBOARDING] Update requested for user: ${ctx.session.user.id}`,
      );
      console.log("[ONBOARDING] Input:", input);
      console.log(
        `[ONBOARDING] Starting upsert for user: ${ctx.session.user.id}`,
      );
      const onboarding = await prisma.onboarding.upsert({
        where: { userId: ctx.session.user.id },
        update: input,
        create: {
          ...input,
          userId: ctx.session.user.id,
        },
      });
      console.log("[ONBOARDING] Upsert completed.");

      // Trigger plan generation if profile is complete
      const isComplete = !!(
        onboarding.goal &&
        onboarding.trainingLevel &&
        onboarding.trainingDaysPerWeek &&
        onboarding.gender
      );

      if (isComplete) {
        try {
          console.log(
            `[ONBOARDING] Triggering plan generation for ${ctx.session.user.id}...`,
          );
          await planService.generatePlan(ctx.session.user.id);
          console.log("[ONBOARDING] Plan generated successfully.");
        } catch (error) {
          console.warn(
            `[ONBOARDING] Plan generation skipped or failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } else {
        console.log(
          "[ONBOARDING] Profile not yet complete for plan generation:",
          {
            goal: onboarding.goal,
            level: onboarding.trainingLevel,
            days: onboarding.trainingDaysPerWeek,
            gender: onboarding.gender,
          },
        );
      }

      return onboarding;
    }),
});
