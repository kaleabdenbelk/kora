import { publicProcedure, router } from "../index";
import { analyticsRouter } from "./analytics";
import { exerciseRouter } from "./exercise";
import { onboardingRouter } from "./onboarding";
import { planRouter } from "./plan";
import { progressionRouter } from "./progression";
import { settingsRouter } from "./settings";
import { workoutRouter } from "./workout";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  onboarding: onboardingRouter,
  analytics: analyticsRouter,
  plan: planRouter,
  progression: progressionRouter,
  exercise: exerciseRouter,
  workout: workoutRouter,
  settings: settingsRouter,
});
export type AppRouter = typeof appRouter;
