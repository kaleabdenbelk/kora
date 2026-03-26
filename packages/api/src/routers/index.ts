import { publicProcedure, router } from "../index";
import { onboardingRouter } from "./onboarding";
import { planRouter } from "./plan";
import { progressionRouter } from "./progression";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  onboarding: onboardingRouter,
  plan: planRouter,
  progression: progressionRouter,
});
export type AppRouter = typeof appRouter;
