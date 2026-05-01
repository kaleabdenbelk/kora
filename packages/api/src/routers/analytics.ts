import { z } from "zod";
import { protectedProcedure, router } from "../index";
import { AnalyticsService } from "../services/analytics.service";

const analyticsService = new AnalyticsService();

export const analyticsRouter = router({
  getMuscleDistribution: protectedProcedure
    .input(z.object({ days: z.number().default(30) }))
    .query(async ({ ctx, input }) => {
      return await analyticsService.getMuscleDistribution(
        ctx.session.user.id,
        input.days,
      );
    }),

  getWorkoutFocusBreakdown: protectedProcedure
    .input(z.object({ days: z.number().default(30) }))
    .query(async ({ ctx, input }) => {
      return await analyticsService.getWorkoutFocusBreakdown(
        ctx.session.user.id,
        input.days,
      );
    }),

  getActivityHeatmap: protectedProcedure
    .input(z.object({ days: z.number().default(365) }))
    .query(async ({ ctx, input }) => {
      return await analyticsService.getActivityHeatmap(
        ctx.session.user.id,
        input.days,
      );
    }),

  getDashboardStats: protectedProcedure.query(async ({ ctx }) => {
    return await analyticsService.getDashboardStats(ctx.session.user.id);
  }),

  getWorkoutHistory: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(10),
        status: z.enum(["Completed", "Modified", "Skipped", "All"]).optional(),
        dateRange: z
          .enum(["Today", "Yesterday", "Last 7 Days", "Last 30 Days", "All"])
          .optional(),
        workoutType: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return await analyticsService.getWorkoutHistory(
        ctx.session.user.id,
        input,
      );
    }),

  getPersonalRecords: protectedProcedure.query(async ({ ctx }) => {
    return await analyticsService.getPersonalRecords(ctx.session.user.id);
  }),

  getCaloricHistory: protectedProcedure.query(async ({ ctx }) => {
    return await analyticsService.getCaloricHistory(ctx.session.user.id);
  }),

  getStreakData: protectedProcedure.query(async ({ ctx }) => {
    return await analyticsService.getStreakData(ctx.session.user.id);
  }),

  getLastWorkout: protectedProcedure.query(async ({ ctx }) => {
    return await analyticsService.getLastWorkout(ctx.session.user.id);
  }),

  getProfileSummary: protectedProcedure.query(async ({ ctx }) => {
    return await analyticsService.getProfileSummary(ctx.session.user.id);
  }),

  getTrends: protectedProcedure
    .input(
      z.object({
        metric: z.string(),
        filter: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return await analyticsService.getTrends(
        ctx.session.user.id,
        input.metric,
        input.filter,
      );
    }),

  getSummary: protectedProcedure
    .input(
      z.object({
        filter: z.string(),
        localDate: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return await analyticsService.getSummary(
        ctx.session.user.id,
        input.filter,
        input.localDate,
      );
    }),
});
