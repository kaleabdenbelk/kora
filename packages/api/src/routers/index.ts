import { onboardingRouter } from "./onboarding";
import { planRouter } from "./plan";
import { publicProcedure, router } from "../index";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  onboarding: onboardingRouter,
  plan: planRouter,
});
export type AppRouter = typeof appRouter;
