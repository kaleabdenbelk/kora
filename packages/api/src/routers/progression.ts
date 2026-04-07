import prisma from "@kora/db";
import { z } from "zod";
import {
  ProgressionEngine,
  ProgressionOptionsSchema,
} from "../engines/progression-engine";
import { rateLimitedProcedure, router } from "../index";

// biome-ignore lint/suspicious/noExplicitAny: prisma client typing can be tricky between packages
const engine = new ProgressionEngine(prisma as any);

export const progressionRouter = router({
  /**
   * Calculates the next targets for an exercise based on user history and provided options.
   * This is a mutation because it might involve complex engine calculations and we want rate limiting.
   */
  calculate: rateLimitedProcedure(10000, 10, "prog:calc")
    .input(
      ProgressionOptionsSchema.extend({
        exerciseId: z.string(),
      }),
    )
    .output(z.any())
    .mutation(async ({ ctx, input }) => {
      const { exerciseId, ...options } = input;
      console.log(
        `[PROGRESSION] Calculating for user: ${ctx.session.user.id}, exercise: ${exerciseId}`,
      );
      const result = await engine.calculateNextTargets(
        ctx.session.user.id,
        exerciseId,
        options,
      );
      console.log("[PROGRESSION] Calculation result:", result);
      return result;
    }),
});
