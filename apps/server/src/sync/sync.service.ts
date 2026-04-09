import { PlanService } from "@kora/api/services/plan.service";
import prisma from "@kora/db";
import { forwardRef, Inject, Injectable } from "@nestjs/common";
import { AnalyticsService } from "../analytics/analytics.service";

export interface SyncMutation {
  id: string;
  type: string;
  payload: any;
}

export interface SyncPayload {
  lastSyncTimestamp?: string | null;
  mutations?: SyncMutation[];
}

@Injectable()
export class SyncService {
  constructor(
    @Inject(forwardRef(() => AnalyticsService))
    private readonly analytics: AnalyticsService,
  ) {}

  async processSync(payload: SyncPayload, userId: string) {
    const { lastSyncTimestamp, mutations } = payload;
    const currentServerTimestamp = new Date().toISOString();

    console.log(
      `[SyncService] Sync request | LastSync: ${lastSyncTimestamp} | Mutations: ${mutations?.length || 0}`,
    );

    const ackIds: string[] = [];

    // 1. Process incoming mutations from the outbox
    if (mutations && Array.isArray(mutations)) {
      for (const mutation of mutations) {
        try {
          // Process different mutation types
          if (mutation.type === "SESSION_COMPLETE") {
            const data = mutation.payload;

            // Typed exercise payload with new analytics fields
            type ExercisePayload = {
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

            const exercises: ExercisePayload[] = Array.isArray(data.exercises)
              ? (data.exercises as ExercisePayload[])
              : [];

            await prisma.$transaction(async (tx) => {
              // 1. Update the session with standard metadata
              await tx.userSession.update({
                where: { id: data.sessionId },
                data: {
                  completedStatus: true,
                  completedAt: new Date(data.completedAt || new Date()),
                  fatigue: data.fatigue,
                  completed: data.completedData,
                  totalDurationSeconds: data.totalDurationSeconds ?? null,
                  activeMinutes: data.activeMinutes ?? null,
                  // These will be refined by the analytics engine below
                },
              });

              // 2. Upsert exercise logs
              for (const ex of exercises) {
                await tx.userExerciseLog.upsert({
                  where: {
                    id: ex.id || `log_${data.sessionId}_${ex.exerciseId}`,
                  },
                  create: {
                    id: ex.id || `log_${data.sessionId}_${ex.exerciseId}`,
                    sessionId: data.sessionId,
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
                where: { id: data.sessionId },
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
              .processSessionEngine(userId, data.sessionId)
              .catch((err: unknown) =>
                console.warn("[SyncService] Analytics engine failed:", err),
              );

            console.log(
              `[SyncService] Successfully processed SESSION_COMPLETE for session ${data.sessionId}`,
            );
          } else if (mutation.type === "PROFILE_UPDATE") {
            const data = mutation.payload;
            console.log(
              `[SyncService] Processing PROFILE_UPDATE for ${userId}`,
            );

            await prisma.$transaction(async (tx) => {
              // Update core user fields
              await tx.user.update({
                where: { id: userId },
                data: {
                  name: data.name,
                  image: data.image,
                },
              });

              // Update onboarding fields if present
              if (data.onboarding) {
                await tx.onboarding.upsert({
                  where: { userId },
                  create: { userId, ...data.onboarding },
                  update: { ...data.onboarding },
                });
              }
            });

            // Recalculate BMR/TDEE after profile update (non-critical)
            await this.analytics
              .recalculateAndSaveMetabolicRates(userId)
              .catch((err: unknown) =>
                console.warn("[SyncService] BMR/TDEE recalc failed:", err),
              );
          }

          ackIds.push(mutation.id);
        } catch (error) {
          console.error(
            `[SyncService] Failed to process mutation ${mutation.id}:`,
            error,
          );
          // If we fail, do not add to ackIds so the client retries
        }
      }
    }

    // 2. Fetch server deltas (records modified since lastSyncTimestamp)
    const deltas: {
      plans: any[];
      sessions: any[];
      exercises: any[];
      profile: any | null;
    } = {
      plans: [],
      sessions: [],
      exercises: [],
      profile: null,
    };

    try {
      // Always sync profile for current user.
      const profile = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          updatedAt: true,
          onboarding: true,
        },
      });

      if (profile) {
        deltas.profile = profile;
        console.log(`[SyncService] Included profile delta for user ${userId}`);
      } else {
        console.warn(`[SyncService] Profile NOT FOUND for user ${userId}`);
      }

      // First sync should hydrate full core data for this user.
      if (!lastSyncTimestamp) {
        let userPlans = await prisma.userPlan.findMany({
          where: { userId },
          include: {
            sessions: {
              include: { exercises: true },
            },
          },
          orderBy: { updatedAt: "desc" },
        });

        if (userPlans.length === 0) {
          console.log(
            `[SyncService] No plans found for user ${userId}. Checking onboarding...`,
          );
          const onboarding = await prisma.onboarding.findUnique({
            where: { userId },
          });
          const isComplete = !!(
            onboarding?.goal &&
            onboarding?.trainingLevel &&
            onboarding?.trainingDaysPerWeek &&
            onboarding?.gender
          );

          if (isComplete) {
            try {
              console.log(
                `[SyncService] Triggering resilient plan generation for ${userId}...`,
              );
              const planService = new PlanService();
              await planService.generatePlan(userId);

              // Refetch plans after generation
              userPlans = await prisma.userPlan.findMany({
                where: { userId },
                include: {
                  sessions: {
                    include: { exercises: true },
                  },
                },
                orderBy: { updatedAt: "desc" },
              });
            } catch (genError) {
              console.warn(
                `[SyncService] Resilient plan generation failed: ${(genError as Error).message}`,
              );
            }
          }
        }

        if (userPlans.length > 0) {
          deltas.plans = userPlans;
        }

        // Keep exercise hydrate broad until per-plan mapping is available.
        const allExercises = await prisma.exercise.findMany();
        if (allExercises.length > 0) {
          deltas.exercises = allExercises;
        }
      } else {
        const timestamp = new Date(lastSyncTimestamp);

        const updatedPlans = await prisma.userPlan.findMany({
          where: {
            userId,
            updatedAt: { gt: timestamp },
          },
          include: {
            sessions: {
              include: { exercises: true },
            },
          },
        });

        if (updatedPlans.length > 0) {
          deltas.plans = updatedPlans;
        }

        // Also fetch any sessions updated since last sync that might not be in updatedPlans
        const updatedSessions = await prisma.userSession.findMany({
          where: {
            userId,
            updatedAt: { gt: timestamp },
          },
          include: { exercises: true },
        });

        if (updatedSessions.length > 0) {
          // Flatten to avoid duplicates if they were already in updatedPlans
          const existingSessionIds = new Set(
            deltas.plans.flatMap((p: { sessions: { id: string }[] }) =>
              p.sessions.map((s) => s.id),
            ),
          );
          const filteredSessions = updatedSessions.filter(
            (s) => !existingSessionIds.has(s.id),
          );
          deltas.sessions = filteredSessions;
        }

        const updatedExercises = await prisma.exercise.findMany({
          where: { updatedAt: { gt: timestamp } },
        });

        if (updatedExercises.length > 0) {
          deltas.exercises = updatedExercises;
        }
      }
    } catch (dbError) {
      console.error("[SyncService] Error fetching deltas:", dbError);
    }

    return {
      success: true,
      serverTimestamp: currentServerTimestamp,
      deltas,
      ackIds,
    };
  }
}
