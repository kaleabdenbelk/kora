import prisma from "@kora/db";
import { Injectable } from "@nestjs/common";

const ACTIVITY_MULTIPLIERS = {
  SEDENTARY: 1.2,
  LIGHTLY_ACTIVE: 1.375,
  MODERATELY_ACTIVE: 1.55,
  VERY_ACTIVE: 1.725,
  EXTRA_ACTIVE: 1.9,
} as const;

export interface BmrTdeeResult {
  bmr: number;
  tdee: number;
}

@Injectable()
export class AnalyticsService {
  // ── Metabolic Calculations ──────────────────────────────────────────────────

  /**
   * Mifflin-St Jeor BMR formula (most accurate for modern fitness apps).
   * Men:   (10 × kg) + (6.25 × cm) – (5 × age) + 5
   * Women: (10 × kg) + (6.25 × cm) – (5 × age) – 161
   */
  calculateBmr(params: {
    weightKg: number;
    heightCm: number;
    age: number;
    gender: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";
  }): number {
    const { weightKg, heightCm, age, gender } = params;
    const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
    return gender === "MALE" ? base + 5 : base - 161;
  }

  calculateTdee(bmr: number, activityLevel: string): number {
    const multiplier =
      ACTIVITY_MULTIPLIERS[activityLevel as keyof typeof ACTIVITY_MULTIPLIERS] ??
      1.2;
    return Math.round(bmr * multiplier);
  }

  /** Persist computed BMR/TDEE onto the user's onboarding record. */
  async recalculateAndSaveMetabolicRates(userId: string): Promise<BmrTdeeResult | null> {
    const onboarding = await prisma.onboarding.findUnique({
      where: { userId },
    });

    if (
      !onboarding ||
      onboarding.weight == null ||
      onboarding.height == null ||
      onboarding.age == null ||
      !onboarding.gender
    ) {
      return null; // Not enough data yet
    }

    const bmr = this.calculateBmr({
      weightKg: onboarding.weight,
      heightCm: onboarding.height,
      age: onboarding.age,
      gender: onboarding.gender,
    });

    const tdee = this.calculateTdee(
      bmr,
      onboarding.activityLevel ?? "SEDENTARY",
    );

    await prisma.onboarding.update({
      where: { userId },
      data: { bmr, tdee },
    });

    return { bmr, tdee };
  }

  // ── Streak Logic ────────────────────────────────────────────────────────────

  /** Recalculate streak after a workout session completes. */
  async updateStreak(userId: string, sessionDate: Date): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        currentStreak: true,
        longestStreak: true,
        lastWorkoutDate: true,
      },
    });

    if (!user) return;

    const today = new Date(sessionDate);
    today.setHours(0, 0, 0, 0);

    const last = user.lastWorkoutDate ? new Date(user.lastWorkoutDate) : null;
    if (last) last.setHours(0, 0, 0, 0);

    const dayMs = 86_400_000;
    const diffDays = last ? Math.round((today.getTime() - last.getTime()) / dayMs) : null;

    let newStreak: number;
    if (diffDays === null) {
      // First ever workout
      newStreak = 1;
    } else if (diffDays === 0) {
      // Already worked out today, no change
      newStreak = user.currentStreak;
    } else if (diffDays === 1) {
      // Consecutive day!
      newStreak = user.currentStreak + 1;
    } else {
      // Streak broken
      newStreak = 1;
    }

    const newLongest = Math.max(newStreak, user.longestStreak);

    await prisma.user.update({
      where: { id: userId },
      data: {
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastWorkoutDate: sessionDate,
      },
    });
  }

  // ── Session Derived Metrics ─────────────────────────────────────────────────

  /**
   * Given a completed session's exercises, compute:
   * - successPercent: how many sets were completed vs planned
   * - totalVolumeKg: sum of weight × reps across all sets
   */
  computeSessionMetrics(exercises: Array<{
    plannedSets?: number | null;
    actualSets?: number | null;
    weightsPerSet?: unknown;
    repsPerSet?: unknown;
  }>): { successPercent: number; totalVolumeKg: number } {
    let totalPlanned = 0;
    let totalCompleted = 0;
    let totalVolume = 0;

    for (const ex of exercises) {
      totalPlanned += ex.plannedSets ?? 0;
      totalCompleted += ex.actualSets ?? 0;

      const weights = Array.isArray(ex.weightsPerSet) ? (ex.weightsPerSet as number[]) : [];
      const reps = Array.isArray(ex.repsPerSet) ? (ex.repsPerSet as number[]) : [];
      for (let i = 0; i < weights.length; i++) {
        totalVolume += (weights[i] ?? 0) * (reps[i] ?? 0);
      }
    }

    const successPercent =
      totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 100;

    return { successPercent, totalVolumeKg: totalVolume };
  }

  // ── Analytics Queries ───────────────────────────────────────────────────────

  /** Muscle distribution: sum volume per muscle group over a date range. */
  async getMuscleDistribution(userId: string, days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);

    const logs = await prisma.userExerciseLog.findMany({
      where: {
        session: { userId, startedAt: { gte: since } },
        isDeleted: false,
      },
      include: {
        exercise: {
          include: { muscles: { include: { muscle: true } } },
        },
      },
    });

    const distribution: Record<string, number> = {};
    for (const log of logs) {
      const weights = Array.isArray(log.weightsPerSet) ? (log.weightsPerSet as number[]) : [];
      const reps = Array.isArray(log.repsPerSet) ? (log.repsPerSet as number[]) : [];
      const volume = weights.reduce((sum, w, i) => sum + w * (reps[i] ?? 0), 0);

      for (const em of log.exercise.muscles) {
        const muscleName = em.muscle.name;
        distribution[muscleName] = (distribution[muscleName] ?? 0) + volume;
      }
    }

    return distribution;
  }

  /** Workout focus: percentage of sessions by split category. */
  async getWorkoutFocusBreakdown(userId: string, days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);

    const sessions = await prisma.userSession.findMany({
      where: { userId, startedAt: { gte: since }, completedStatus: true },
      select: { planned: true },
    });

    const splitCounts: Record<string, number> = {};
    for (const s of sessions) {
      const planned = s.planned as { split?: string };
      const split = planned?.split ?? "UNKNOWN";
      splitCounts[split] = (splitCounts[split] ?? 0) + 1;
    }

    const total = Object.values(splitCounts).reduce((a, b) => a + b, 0);
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(splitCounts)) {
      result[k] = total > 0 ? Math.round((v / total) * 100) : 0;
    }
    return result;
  }

  /** Activity heatmap: list of workout dates with session counts. */
  async getActivityHeatmap(userId: string, days = 365) {
    const since = new Date(Date.now() - days * 86_400_000);

    const sessions = await prisma.userSession.findMany({
      where: { userId, completedStatus: true, startedAt: { gte: since } },
      select: { startedAt: true },
    });

    const heatmap: Record<string, number> = {};
    for (const s of sessions) {
      if (!s.startedAt) continue;
      const day = s.startedAt.toISOString().split("T").at(0) ?? ""; // "YYYY-MM-DD"
      if (!day) continue;
      heatmap[day] = (heatmap[day] ?? 0) + 1;
    }
    return heatmap;
  }

  /** Aggregated stats for the user's analytics dashboard. */
  async getDashboardStats(userId: string) {
    const [user, sessionCount, bodyMetrics] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          currentStreak: true,
          longestStreak: true,
          lastWorkoutDate: true,
          onboarding: { select: { bmr: true, tdee: true, activityLevel: true } },
        },
      }),
      prisma.userSession.count({ where: { userId, completedStatus: true } }),
      prisma.bodyMetrics.findFirst({
        where: { userId, isDeleted: false },
        orderBy: { recordedAt: "desc" },
      }),
    ]);

    return {
      currentStreak: user?.currentStreak ?? 0,
      longestStreak: user?.longestStreak ?? 0,
      lastWorkoutDate: user?.lastWorkoutDate ?? null,
      totalWorkouts: sessionCount,
      bmr: user?.onboarding?.bmr ?? null,
      tdee: user?.onboarding?.tdee ?? null,
      latestBodyMetrics: bodyMetrics ?? null,
    };
  }

  // ── Engine implementation (Phase 1-3) ──────────────────────────────────────

  /**
   * Main entry point for post-session processing.
   * Runs after a session is synced from the frontend.
   */
  async processSessionEngine(userId: string, sessionId: string): Promise<void> {
    const session = await prisma.userSession.findUnique({
      where: { id: sessionId },
      include: { exercises: true },
    });

    if (!session || !session.completedStatus) return;

    // 1. Compute and Persist Session Metrics (Phase 2 Success/Volume)
    const metrics = this.computeSessionMetrics(session.exercises);
    
    // Calculate Active Minutes from logs if repDurationsSeconds exist
    let totalActiveSeconds = 0;
    for (const log of session.exercises) {
      const repDurs = Array.isArray(log.repDurationsSeconds) ? (log.repDurationsSeconds as number[]) : [];
      const restDurs = Array.isArray(log.restTimesSeconds) ? (log.restTimesSeconds as number[]) : [];
      totalActiveSeconds += repDurs.reduce((a, b) => a + b, 0) + restDurs.reduce((a, b) => a + b, 0);
    }
    const activeMinutes = Math.round((totalActiveSeconds / 60) * 10) / 10;

    await prisma.userSession.update({
      where: { id: sessionId },
      data: {
        successPercent: metrics.successPercent,
        totalVolumeKg: metrics.totalVolumeKg,
        activeMinutes: activeMinutes || (session.totalDurationSeconds ? session.totalDurationSeconds / 60 : 0),
      },
    });

    // 2. Update Streaks
    await this.updateStreak(userId, session.completedAt || new Date()).catch(
      (e) => console.warn(`[AnalyticsEngine] Streak update failed: ${e.message}`),
    );

    // 3. Track Personal Records
    await this.updatePersonalRecords(userId, sessionId).catch((e) =>
      console.warn(`[AnalyticsEngine] PR update failed: ${e.message}`),
    );

    // 4. Estimate Caloric Burn
    await this.calculateCaloricBurn(userId, sessionId).catch((e) =>
      console.warn(`[AnalyticsEngine] Caloric burn failed: ${e.message}`),
    );

    console.log(`[AnalyticsEngine] Completed processing for session ${sessionId}`);
  }

  /**
   * Paginated workout history for a user.
   */
  async getWorkoutHistory(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [sessions, total] = await Promise.all([
      prisma.userSession.findMany({
        where: { userId, completedStatus: true, isDeleted: false },
        orderBy: { completedAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          dayNumber: true,
          week: true,
          completedAt: true,
          totalDurationSeconds: true,
          activeMinutes: true,
          successPercent: true,
          totalVolumeKg: true,
          fatigue: true,
          planned: true, // For session title
        },
      }),
      prisma.userSession.count({ where: { userId, completedStatus: true, isDeleted: false } }),
    ]);

    return {
      sessions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Scans a session's exercise logs and updates PersonalRecord table if new PRs are found.
   */
  async updatePersonalRecords(userId: string, sessionId: string): Promise<void> {
    const logs = await prisma.userExerciseLog.findMany({
      where: { sessionId },
    });

    for (const log of logs) {
      const weights = Array.isArray(log.weightsPerSet) ? (log.weightsPerSet as number[]) : [];
      const reps = Array.isArray(log.repsPerSet) ? (log.repsPerSet as number[]) : [];

      if (weights.length === 0) continue;

      let sessionMaxWeight = 0;
      let sessionMaxReps = 0;
      let sessionMaxVolume = 0;

      for (let i = 0; i < weights.length; i++) {
        const w = weights[i] ?? 0;
        const r = reps[i] ?? 0;
        const vol = w * r;

        if (vol > sessionMaxVolume) {
          sessionMaxVolume = vol;
        }

        if (w > sessionMaxWeight) {
          sessionMaxWeight = w;
          sessionMaxReps = r;
        }
      }

      // Brzycki Formula for estimated 1RM: Weight * (36 / (37 - reps))
      const estimated1RM =
        sessionMaxReps > 0 && sessionMaxReps < 37
          ? Math.round(sessionMaxWeight * (36 / (37 - sessionMaxReps)) * 10) / 10
          : sessionMaxWeight;

      // Upsert: Only update if the new maxWeightKg or maxVolume is higher
      const existing = await prisma.personalRecord.findUnique({
        where: { userId_exerciseId: { userId, exerciseId: log.exerciseId } },
      });

      if (
        !existing ||
        sessionMaxWeight > existing.maxWeightKg ||
        sessionMaxVolume > (existing.maxVolume ?? 0)
      ) {
        await prisma.personalRecord.upsert({
          where: { userId_exerciseId: { userId, exerciseId: log.exerciseId } },
          create: {
            userId,
            exerciseId: log.exerciseId,
            maxWeightKg: sessionMaxWeight,
            reps: sessionMaxReps,
            estimated1RM,
            maxVolume: sessionMaxVolume,
            sessionId,
            recordedAt: new Date(),
          },
          update: {
            maxWeightKg: Math.max(sessionMaxWeight, existing?.maxWeightKg ?? 0),
            reps: sessionMaxWeight > (existing?.maxWeightKg ?? 0) ? sessionMaxReps : existing?.reps,
            estimated1RM: Math.max(estimated1RM, existing?.estimated1RM ?? 0),
            maxVolume: Math.max(sessionMaxVolume, existing?.maxVolume ?? 0),
            sessionId,
            recordedAt: new Date(),
          },
        });
      }
    }
  }

  /**
   * Calculates caloric burn for a session and logs it to DailyCaloricLog.
   * Uses MET (Metabolic Equivalent) for weightlifting: approx 5.0 MET.
   */
  async calculateCaloricBurn(userId: string, sessionId: string): Promise<void> {
    const session = await prisma.userSession.findUnique({
      where: { id: sessionId },
      include: { user: { include: { onboarding: true } } },
    });

    if (!session || !session.totalDurationSeconds || !session.user.onboarding?.weight) return;

    // MET Calculation: kcal = MET * weight_kg * duration_hrs
    // General vigorous weight lifting is ~6.0 MET, moderate is ~3.5-5.0. 
    // We adjust based on reported fatigue (RPE).
    const fatigueFactor = session.fatigue ? session.fatigue / 5 : 1; // 10 RPE -> 2x multiplier (unrealistic, but for scaling)
    const baseMet = 5.0; 
    const adjustedMet = baseMet * (0.8 + (fatigueFactor * 0.4)); // Range ~4.0 to ~8.0
    
    const durationHrs = session.totalDurationSeconds / 3600;
    const workoutBurn = Math.round(adjustedMet * session.user.onboarding.weight * durationHrs);

    const date = new Date(session.completedAt || new Date());
    date.setHours(0, 0, 0, 0);

    // Assume basal burn is TDEE / 24 * duration OR just use the daily proportion if we're doing daily logs
    const dailyBmr = session.user.onboarding.bmr || 2000;
    
    await prisma.dailyCaloricLog.upsert({
      where: { userId_date: { userId, date } },
      create: {
        userId,
        date,
        basalBurn: dailyBmr,
        workoutBurn: workoutBurn,
        activeBurn: workoutBurn, // For now, active burn is just workout burn
        totalBurn: dailyBmr + workoutBurn,
      },
      update: {
        workoutBurn: { increment: workoutBurn },
        activeBurn: { increment: workoutBurn },
        totalBurn: { increment: workoutBurn },
      },
    });
  }

  /** Fetch all PRs for a user. */
  async getPersonalRecords(userId: string) {
    return prisma.personalRecord.findMany({
      where: { userId },
      include: { exercise: { select: { name: true, muscles: { include: { muscle: true } } } } },
      orderBy: { maxWeightKg: "desc" },
    });
  }

  /** Fetch caloric history for a user. */
  async getCaloricHistory(userId: string) {
    return prisma.dailyCaloricLog.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 30,
    });
  }

  // ── Endpoints missing from frontend ─────────────────────────────────────────

  /** Streak summary — maps to GET /analytics/streak */
  async getStreakData(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { currentStreak: true, longestStreak: true, lastWorkoutDate: true },
    });
    return {
      currentStreak: user?.currentStreak ?? 0,
      longestStreak: user?.longestStreak ?? 0,
      lastWorkoutDate: user?.lastWorkoutDate ?? null,
    };
  }

  /**
   * Details of the most recently completed session —
   * maps to GET /analytics/last-workout
   */
  async getLastWorkout(userId: string) {
    const session = await prisma.userSession.findFirst({
      where: { userId, completedStatus: true },
      orderBy: { completedAt: "desc" },
      include: {
        exercises: true,
        plan: { select: { name: true } },
      },
    });

    if (!session) return null;

    const planned = session.planned as { name?: string; exercises?: unknown[] };
    return {
      id: session.id,
      date: session.completedAt?.toISOString() ?? null,
      duration: session.totalDurationSeconds
        ? Math.round(session.totalDurationSeconds / 60)
        : 0,
      exercisesCompleted: session.exercises.filter((e) => e.completed).length,
      totalExercises: session.exercises.length,
      caloriesBurned: 0, // Placeholder — pull from DailyCaloricLog if needed
      weightLifted: session.totalVolumeKg ?? 0,
      planName: session.plan?.name ?? "Workout",
      sessionName: planned?.name ?? `Day ${session.dayNumber}`,
    };
  }

  /**
   * Aggregated profile stats including BMI and best-of PRs —
   * maps to GET /analytics/profile-summary
   */
  async getProfileSummary(userId: string) {
    const [user, sessionCount, prList, onboarding] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { currentStreak: true },
      }),
      prisma.userSession.count({ where: { userId, completedStatus: true } }),
      prisma.personalRecord.findMany({
        where: { userId },
        include: { exercise: { select: { name: true } } },
        orderBy: { maxWeightKg: "desc" },
        take: 5,
      }),
      prisma.onboarding.findUnique({ where: { userId } }),
    ]);

    // BMI
    const heightM = onboarding?.height ? onboarding.height / 100 : null;
    const bmi =
      heightM && onboarding?.weight
        ? Math.round((onboarding.weight / (heightM * heightM)) * 10) / 10
        : 0;
    const bmiStatus =
      bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese";

    return {
      stats: {
        totalWorkouts: sessionCount,
        totalHours: 0, // TODO: sum totalDurationSeconds / 3600
        totalExercises: 0,
        currentStreak: user?.currentStreak ?? 0,
        consistency: 0,
        bmi,
        bmiStatus,
        goalWeight: onboarding?.goalWeight ?? 0,
      },
      bestOf: prList.map((pr) => ({
        name: pr.exercise.name,
        weight: pr.maxWeightKg,
        reps: pr.reps ?? 1,
        icon: "Dumbbell",
      })),
    };
  }

  /**
   * Volume or caloric trend data over a range —
   * maps to GET /analytics/trends?metric=Tonnage&filter=Week
   */
  async getTrends(userId: string, metric: string, filter: string) {
    const filterDays: Record<string, number> = {
      Day: 1,
      Week: 7,
      Month: 30,
      Year: 365,
    };
    const days = filterDays[filter] ?? 30;
    const since = new Date(Date.now() - days * 86_400_000);

    const sessions = await prisma.userSession.findMany({
      where: {
        userId,
        completedStatus: true,
        completedAt: { gte: since },
        isDeleted: false,
      },
      orderBy: { completedAt: "asc" },
      select: {
        completedAt: true,
        totalVolumeKg: true,
        totalDurationSeconds: true,
      },
    });

    if (sessions.length === 0) {
      return { labels: [], datasets: [{ data: [] }] };
    }

    const labels = sessions.map((s) =>
      s.completedAt ? s.completedAt.toLocaleDateString("en-US", { weekday: "short" }) : ""
    );

    let data: number[];
    switch (metric) {
      case "Tonnage":
        data = sessions.map((s) => s.totalVolumeKg ?? 0);
        break;
      case "Time":
        data = sessions.map((s) =>
          s.totalDurationSeconds ? Math.round(s.totalDurationSeconds / 60) : 0
        );
        break;
      default:
        data = sessions.map(() => 0);
    }

    return { labels, datasets: [{ data }] };
  }

  /**
   * Summary stats for a filter period —
   * maps to GET /analytics/summary?filter=Week
   */
  async getSummary(userId: string, filter: string) {
    const filterDays: Record<string, number> = {
      Day: 1, Week: 7, Month: 30, Year: 365,
    };
    const days = filterDays[filter] ?? 7;
    const since = new Date(Date.now() - days * 86_400_000);

    const [user, sessions] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { currentStreak: true, onboarding: { select: { tdee: true } } },
      }),
      prisma.userSession.findMany({
        where: { userId, completedStatus: true, completedAt: { gte: since }, isDeleted: false },
        select: { totalVolumeKg: true, totalDurationSeconds: true, successPercent: true },
      }),
    ]);

    const totalTonnage = sessions.reduce((a, s) => a + (s.totalVolumeKg ?? 0), 0);
    const totalDuration = sessions.reduce((a, s) => a + (s.totalDurationSeconds ?? 0), 0);
    const avgSuccess =
      sessions.length > 0
        ? Math.round(sessions.reduce((a, s) => a + (s.successPercent ?? 100), 0) / sessions.length)
        : 0;

    return {
      currentStreak: user?.currentStreak ?? 0,
      strikes: user?.currentStreak ?? 0,
      progressPercent: avgSuccess,
      totalTonnage,
      remainingCount: 0, // TODO: target workouts for the period
      caloriesBurned: 0, // TODO: sum from DailyCaloricLog
      totalDuration: Math.round(totalDuration / 60),
      totalWorkouts: sessions.length,
    };
  }
}
