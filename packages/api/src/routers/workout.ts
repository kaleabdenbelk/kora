import { z } from "zod";
import { protectedProcedure, router } from "../index";
import { SessionService } from "../services/session.service";

const sessionService = new SessionService();

export const workoutRouter = router({
  save: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        planId: z.string().optional(),
        dayNumber: z.number().optional(),
        week: z.number().optional(),
        completedAt: z.string().optional(),
        fatigue: z.number().optional(),
        completedData: z.any().optional(),
        totalDurationSeconds: z.number().optional(),
        activeMinutes: z.number().optional(),
        exercises: z.array(
          z.object({
            id: z.string().optional(),
            exerciseId: z.string(),
            plannedSets: z.number().optional(),
            plannedReps: z.string().optional(),
            actualSets: z.number().optional(),
            completed: z.boolean().optional(),
            weightsPerSet: z.array(z.number()).optional(),
            repsPerSet: z.array(z.number()).optional(),
            rpePerSet: z.array(z.number()).optional(),
            restTimesSeconds: z.array(z.number()).optional(),
            repDurationsSeconds: z.array(z.array(z.number())).optional(),
            notes: z.string().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return await sessionService.completeSession(ctx.session.user.id, input);
    }),
});
