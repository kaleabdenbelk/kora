import prisma from "@kora/db";
import { z } from "zod";
import { publicProcedure, router } from "../index";

export const exerciseRouter = router({
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

      const exercises = await prisma.exercise.findMany({
        where: {
          name: {
            contains: query,
            mode: "insensitive",
          },
          isDeleted: false,
        },
        include: {
          category: true,
          movementPattern: true,
          muscles: {
            include: {
              muscle: true,
            },
          },
        },
        take: limit,
        skip: offset,
        orderBy: {
          name: "asc",
        },
      });

      return exercises;
    }),
});
