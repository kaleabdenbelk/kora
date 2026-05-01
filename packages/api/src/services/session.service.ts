import prisma from "@kora/db";
import { AnalyticsService } from "./analytics.service";

export type ExercisePayload = {
  id?: string;
  exerciseId: string;
  plannedSets?: number;
  plannedReps?: string;
  actualSets?: number;
  completed?: boolean;
  weightsPerSet?: number[];
  repsPerSet?: number[];
  rpePerSet?: number[];
  restTimesSeconds?: number[];
  repDurationsSeconds?: number[][];
  notes?: string;
};

export type CompleteSessionData = {
  sessionId: string;
  planId?: string;
  dayNumber?: number;
  week?: number;
  completedAt?: string;
  fatigue?: number;
  completedData?: unknown;
  totalDurationSeconds?: number;
  activeMinutes?: number;
  exercises: ExercisePayload[];
};

export class SessionService {
  private analytics = new AnalyticsService();

  async completeSession(userId: string, data: CompleteSessionData) {
    const { sessionId, exercises } = data;

    await prisma.$transaction(async (tx) => {
      // 1. Resiliently Upsert the session metadata
      await tx.userSession.upsert({
        where: { id: sessionId },
        create: {
          id: sessionId,
          userId: userId,
          planId: data.planId || "", // We expect this for new sessions
          dayNumber: data.dayNumber || 1,
          week: data.week || 1,
          planned: {
            name: "Completed Workout",
            exercises: [],
          },
          completedStatus: true,
          completedAt: new Date(data.completedAt || new Date()),
          fatigue: data.fatigue,
          // biome-ignore lint/suspicious/noExplicitAny: prisma json field
          completed: (data.completedData as any) || {},
          totalDurationSeconds: data.totalDurationSeconds ?? null,
          activeMinutes: data.activeMinutes ?? null,
        },
        update: {
          completedStatus: true,
          completedAt: new Date(data.completedAt || new Date()),
          fatigue: data.fatigue,
          // biome-ignore lint/suspicious/noExplicitAny: prisma json field
          completed: data.completedData as any,
          totalDurationSeconds: data.totalDurationSeconds ?? null,
          activeMinutes: data.activeMinutes ?? null,
        },
      });

      // 2. Upsert exercise logs
      for (const ex of exercises) {
        const logId = ex.id || `log_${sessionId}_${ex.exerciseId}`;
        await tx.userExerciseLog.upsert({
          where: { id: logId },
          create: {
            id: logId,
            sessionId: sessionId,
            exerciseId: ex.exerciseId,
            plannedSets: ex.plannedSets || 0,
            plannedReps: ex.plannedReps || "",
            actualSets: ex.actualSets,
            completed: ex.completed ?? true,
            weightsPerSet: ex.weightsPerSet,
            repsPerSet: ex.repsPerSet,
            rpePerSet: ex.rpePerSet,
            restTimesSeconds: ex.restTimesSeconds,
            repDurationsSeconds: ex.repDurationsSeconds,
            notes: ex.notes,
          },
          update: {
            actualSets: ex.actualSets,
            completed: ex.completed ?? true,
            weightsPerSet: ex.weightsPerSet,
            repsPerSet: ex.repsPerSet,
            rpePerSet: ex.rpePerSet,
            restTimesSeconds: ex.restTimesSeconds,
            repDurationsSeconds: ex.repDurationsSeconds,
            notes: ex.notes,
          },
        });
      }

      // 3. Touch the parent plan
      const session = await tx.userSession.findUnique({
        where: { id: sessionId },
        select: { planId: true },
      });
      if (session?.planId) {
        await tx.userPlan.update({
          where: { id: session.planId },
          data: { updatedAt: new Date() },
        });
      }
    });

    // 4. Process analytics engine (Source of Truth for PRs, Volume, etc.)
    await this.analytics
      .processSessionEngine(userId, sessionId)
      .catch((err: unknown) =>
        console.warn("[SessionService] Analytics engine failed:", err),
      );

    return { success: true, sessionId };
  }
}
