import { publicProcedure, router } from "../index";
import { exerciseRouter } from "./exercise";
import { onboardingRouter } from "./onboarding";
import { planRouter } from "./plan";
import { progressionRouter } from "./progression";
import { workoutRouter } from "./workout";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  onboarding: onboardingRouter,
  plan: planRouter,
  progression: progressionRouter,
  exercise: exerciseRouter,
  workout: workoutRouter,
});
export type AppRouter = typeof appRouter;
