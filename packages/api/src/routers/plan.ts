import { rateLimitedProcedure, router } from "../index";
import { PlanService } from "../services/plan.service";

const planService = new PlanService();

export const planRouter = router({
  // Strict limit: 1 request every 60 seconds per user
  generate: rateLimitedProcedure(60000, 1, "plan:gen").mutation(
    async ({ ctx }) => {
      return await planService.generatePlan(ctx.session.user.id);
    },
  ),

  // Standard limit: 30 requests per minute
  getActive: rateLimitedProcedure(60000, 30, "plan:read").query(
    async ({ ctx }) => {
      return await planService.getActivePlan(ctx.session.user.id);
    },
  ),
});
