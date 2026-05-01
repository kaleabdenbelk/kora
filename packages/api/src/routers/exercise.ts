import prisma from "@kora/db";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../index";

export const exerciseRouter = router({
  // ── Fuzzy search (existing) ─────────────────────────────────────────────────
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(50).optional().default(20),
        offset: z.number().min(0).optional().default(0),
      }),
    )
    .output(z.any())
    .query(async ({ input }) => {
      const { query, limit, offset } = input;
      return prisma.exercise.findMany({
        where: {
          name: { contains: query, mode: "insensitive" },
          isDeleted: false,
        },
        include: {
          category: true,
          movementPattern: true,
          muscles: { include: { muscle: true } },
          equipment: { include: { equipment: true } },
        },
        take: limit,
        skip: offset,
        orderBy: { name: "asc" },
      });
    }),

  // ── Filtered browse (new) ───────────────────────────────────────────────────
  // Lets users filter by split, muscle, equipment, level — used in ExercisePicker
  browse: protectedProcedure
    .input(
      z.object({
        split: z.enum(["PUSH", "PULL", "LEGS", "CORE", "FULL_BODY"]).optional(),
        muscleGroup: z.string().optional(), // partial muscle name, e.g. "Chest"
        equipment: z.string().optional(), // partial equipment name, e.g. "Dumbbell"
        level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
        query: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional().default(30),
        offset: z.number().int().min(0).optional().default(0),
      }),
    )
    .output(z.any())
    .query(async ({ input }) => {
      const { split, muscleGroup, equipment, level, query, limit, offset } =
        input;

      return prisma.exercise.findMany({
        where: {
          isDeleted: false,
          ...(split ? { split } : {}),
          ...(level ? { level } : {}),
          ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
          ...(muscleGroup
            ? {
                muscles: {
                  some: {
                    muscle: {
                      name: { contains: muscleGroup, mode: "insensitive" },
                    },
                  },
                },
              }
            : {}),
          ...(equipment
            ? {
                equipment: {
                  some: {
                    equipment: {
                      name: { contains: equipment, mode: "insensitive" },
                    },
                  },
                },
              }
            : {}),
        },
        select: {
          id: true,
          name: true,
          gifUrl: true,
          split: true,
          level: true,
          type: true,
          defaultSets: true,
          defaultReps: true,
          restMin: true,
          restMax: true,
          tags: true,
          category: { select: { name: true } },
          muscles: {
            select: { muscle: { select: { name: true } }, role: true },
          },
          equipment: {
            select: { equipment: { select: { name: true } } },
          },
        },
        take: limit,
        skip: offset,
        orderBy: { name: "asc" },
      });
    }),

  // ── Get single exercise by ID (for preview modal) ──────────────────────────
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .output(z.any())
    .query(async ({ input }) => {
      const exercise = await prisma.exercise.findUnique({
        where: { id: input.id, isDeleted: false },
        include: {
          category: true,
          movementPattern: true,
          muscles: { include: { muscle: true } },
          equipment: { include: { equipment: true } },
        },
      });
      if (!exercise) throw new Error("Exercise not found");
      return exercise;
    }),

  // ── Saved Exercises ────────────────────────────────────────────────────────
  toggleSave: protectedProcedure
    .input(z.object({ exerciseId: z.string(), save: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { exerciseId, save } = input;
      const userId = ctx.session.user.id;

      if (save) {
        return prisma.user.update({
          where: { id: userId },
          data: { savedExercises: { connect: { id: exerciseId } } },
        });
      }
      return prisma.user.update({
        where: { id: userId },
        data: { savedExercises: { disconnect: { id: exerciseId } } },
      });
    }),

  getSaved: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { savedExercises: { where: { isDeleted: false } } },
    });
    return user?.savedExercises || [];
  }),

  isSaved: protectedProcedure
    .input(z.object({ exerciseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          savedExercises: {
            where: { id: input.exerciseId },
            select: { id: true },
          },
        },
      });
      return (user?.savedExercises?.length ?? 0) > 0;
    }),
});
