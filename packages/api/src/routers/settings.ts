import { z } from 'zod';
import { router, protectedProcedure } from '../index';
import prisma from '@kora/db';

export const settingsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: ctx.session.user.id },
    });

    if (!userSettings) {
      // Return defaults if none exist
      return {
        dailyReminder: true,
        weeklyProgress: true,
        streakRanking: true,
        appUpdates: true,
        telegramOption: false,
        emailOption: true,
        muteAll: false,
        reminderHour: 6,
        reminderMinute: 30,
        reminderPeriod: 'AM' as const,
      };
    }

    return userSettings;
  }),

  update: protectedProcedure
    .input(
      z.object({
        dailyReminder: z.boolean().optional(),
        weeklyProgress: z.boolean().optional(),
        streakRanking: z.boolean().optional(),
        appUpdates: z.boolean().optional(),
        telegramOption: z.boolean().optional(),
        emailOption: z.boolean().optional(),
        muteAll: z.boolean().optional(),
        reminderHour: z.number().min(1).max(12).optional(),
        reminderMinute: z.number().min(0).max(59).optional(),
        reminderPeriod: z.enum(['AM', 'PM']).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userSettings = await prisma.userSettings.upsert({
        where: { userId: ctx.session.user.id },
        update: input,
        create: {
          ...input,
          userId: ctx.session.user.id,
        },
      });

      return userSettings;
    }),
});
