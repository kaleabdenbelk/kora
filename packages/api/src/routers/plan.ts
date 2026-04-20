import { z } from "zod";
import { protectedProcedure, rateLimitedProcedure, router } from "../index";
import { PlanService } from "../services/plan.service";

const planService = new PlanService();

// ─── Shared Input Schemas ─────────────────────────────────────────────────────

const customPlanDaySchema = z.object({
  dayNumber: z.number().int().min(1),
  name: z.string().min(1).max(80),
  exercises: z.array(
    z.object({
      exerciseId: z.string(),
      sets: z.number().int().min(1).max(20),
      reps: z.string().min(1), // e.g. "8-12", "AMRAP", "30s"
      restTime: z.number().int().optional(),
      intensity: z.string().optional(),
    }),
  ).min(1),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const planRouter = router({
  // ── Generate (AI) — strict rate limit ──────────────────────────────────────
  generate: rateLimitedProcedure(60000, 1, "plan:gen", false)
    .output(z.any())
    .mutation(async ({ ctx }) => {
      return await planService.generatePlan(ctx.session.user.id);
    }),

  // ── Get active plan ────────────────────────────────────────────────────────
  getActive: rateLimitedProcedure(60000, 30, "plan:read")
    .output(z.any())
    .query(async ({ ctx }) => {
      return await planService.getActivePlan(ctx.session.user.id);
    }),

  // ── Get plan by ID ─────────────────────────────────────────────────────────
  getById: protectedProcedure
    .input(z.object({ planId: z.string() }))
    .output(z.any())
    .query(async ({ ctx, input }) => {
      return await planService.getById(ctx.session.user.id, input.planId);
    }),

  // ── List all plans (for "My Plans" screen) ─────────────────────────────────
  list: protectedProcedure
    .output(z.any())
    .query(async ({ ctx }) => {
      return await planService.listPlans(ctx.session.user.id);
    }),

  // ── Switch active plan ─────────────────────────────────────────────────────
  setActive: protectedProcedure
    .input(z.object({ planId: z.string() }))
    .output(z.any())
    .mutation(async ({ ctx, input }) => {
      return await planService.setActivePlan(
        ctx.session.user.id,
        input.planId,
      );
    }),

  // ── Replace an exercise in future sessions ─────────────────────────────────
  replaceExercise: protectedProcedure
    .input(
      z.object({
        planId: z.string(),
        oldExerciseId: z.string(),
        newExerciseId: z.string(),
        // "next" = only the next upcoming session; "all" = all future uncompleted
        scope: z.enum(["next", "all"]).default("all"),
      }),
    )
    .output(z.any())
    .mutation(async ({ ctx, input }) => {
      return await planService.replaceExercise(
        ctx.session.user.id,
        input.planId,
        input.oldExerciseId,
        input.newExerciseId,
        input.scope,
      );
    }),

  // ── Create or Fully Update a custom plan ──────────────────────────────────
  createCustom: protectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1).max(100),
        durationWeeks: z.number().int().min(1).optional(),
        days: z.array(customPlanDaySchema).min(1),
      }),
    )
    .output(z.any())
    .mutation(async ({ ctx, input }) => {
      return await planService.createCustomPlan(ctx.session.user.id, input);
    }),

  // ── Granular update of a single day template ───────────────────────────────
  updateDay: protectedProcedure
    .input(
      z.object({
        planId: z.string(),
        dayNumber: z.number().int().min(1),
        dayUpdate: customPlanDaySchema,
      }),
    )
    .output(z.any())
    .mutation(async ({ ctx, input }) => {
      return await planService.updateDayTemplate(
        ctx.session.user.id,
        input.planId,
        input.dayNumber,
        input.dayUpdate,
      );
    }),
});
