import { z } from "zod";

// Generic interface to decouple from @prisma/client during testing
export interface MinimalPrismaClient {
  userExerciseLog: {
    findFirst(args: any): Promise<any>;
  };
}

const MAX_WEIGHT_INCREMENT = 5; // Limit max jump to 5kg for safety

export const ProgressionOptionsSchema = z.object({
  plannedSets: z.number().int().positive(),
  plannedReps: z
    .string()
    .regex(/^\d+(-\d+)?$/, "Invalid rep range format (e.g., '8' or '8-12')"),
  lastFatigue: z.number().min(1).max(10).optional(),
});

export type ProgressionOptions = z.infer<typeof ProgressionOptionsSchema>;

export interface ProgressionResult {
  weight: number;
  reps: string;
  rpe: number;
  note: string;
}

export class ProgressionEngine {
  constructor(private prisma: MinimalPrismaClient) {}

  /**
   * Calculates the next targets for an exercise based on user's history and fatigue.
   */
  async calculateNextTargets(
    userId: string,
    exerciseId: string,
    options: ProgressionOptions,
  ): Promise<ProgressionResult> {
    // 0. Security: Validate input options
    const validated = ProgressionOptionsSchema.safeParse(options);
    if (!validated.success) {
      throw new Error(
        `Invalid progression options: ${validated.error.message}`,
      );
    }

    const { plannedReps, lastFatigue } = validated.data;

    // 1. Fetch latest completed log for this exercise
    const latestLog = await this.prisma.userExerciseLog.findFirst({
      where: {
        session: { userId },
        exerciseId,
        completed: true,
      },
      orderBy: { createdAt: "desc" },
      include: {
        session: true,
      },
    });

    const [minReps, maxReps] = this.parseRepRange(plannedReps);

    if (!latestLog || !latestLog.repsPerSet || !latestLog.weightsPerSet) {
      // No history: Return base targets
      return {
        weight: 0, // 0 indicates user should find their baseline
        reps: plannedReps,
        rpe: 7,
        note: "Initial session - find your baseline load for the prescribed rep range.",
      };
    }

    // Security check: Ensure arrays are of expected type
    const rawReps = latestLog.repsPerSet as any[];
    const rawWeights = latestLog.weightsPerSet as any[];
    const rawRpes = (latestLog.rpePerSet as any[]) || [];

    if (
      !Array.isArray(rawReps) ||
      !Array.isArray(rawWeights) ||
      rawReps.length === 0
    ) {
      return {
        weight: 0,
        reps: plannedReps,
        rpe: 7,
        note: "Incomplete history data. Find your baseline load.",
      };
    }

    // Safety: Filter and sanitize data
    const validReps = rawReps.filter(
      (r): r is number => typeof r === "number" && r >= 0,
    );
    const validWeights = rawWeights.filter(
      (w): w is number => typeof w === "number" && w >= 0,
    );
    const validRpes = rawRpes.filter(
      (r): r is number => typeof r === "number" && r >= 1 && r <= 10,
    );

    const avgRpe =
      validRpes.length > 0
        ? validRpes.reduce((a, b) => a + b, 0) / validRpes.length
        : 8;

    const lastWeight = validWeights[0] || 0;
    const sessionFatigue =
      lastFatigue ?? (latestLog.session as any).fatigue ?? 5;

    let nextWeight = lastWeight;
    let nextReps = plannedReps;
    let note = "";

    // Progression Logic
    const hitMaxRepsAllSets = validReps.every((r) => r >= maxReps);
    const hitBelowMinAnySet = validReps.some((r) => r < minReps);

    // High Fatigue Adjustment
    if (sessionFatigue > 8) {
      note = "High fatigue detected in last session. ";
      if (hitMaxRepsAllSets) {
        note += "Maintaining weight to ensure recovery while hitting reps.";
        nextWeight = lastWeight;
        nextReps = `${maxReps}-${maxReps}`;
      } else {
        note += "Consider a slight deload or maintaining current intensity.";
        nextWeight = lastWeight;
        nextReps = `${minReps}-${minReps}`;
      }
      return { weight: nextWeight, reps: nextReps, rpe: 7, note };
    }

    if (hitMaxRepsAllSets && avgRpe < 9) {
      // LEVEL UP
      const proposedIncrement = 2.5;
      const actualIncrement = Math.min(proposedIncrement, MAX_WEIGHT_INCREMENT);
      nextWeight =
        lastWeight > 0 ? lastWeight + actualIncrement : actualIncrement;
      nextReps = `${minReps}-${minReps + 1}`;
      note = `Progressing to ${nextWeight}kg. Strong performance last time!`;
    } else if (hitBelowMinAnySet || avgRpe >= 9.5) {
      // STRUGGLE
      nextWeight = lastWeight;
      nextReps = `${minReps}-${minReps}`;
      if (avgRpe >= 10) {
        note =
          "Last session was extremely high intensity. Suggesting a slight deload focus on technique.";
      } else {
        note =
          "Last session was very challenging. Focus on form and reaching the minimum rep target.";
      }
    } else {
      // STEADY
      nextWeight = lastWeight;
      const bestReps = Math.max(...validReps);
      nextReps = `${Math.min(maxReps, bestReps)}-${maxReps}`;
      note = "Maintaining weight. Push to increase your reps within the range.";
    }

    return {
      weight: nextWeight,
      reps: nextReps,
      rpe: 8,
      note,
    };
  }

  private parseRepRange(reps: string): [number, number] {
    const parts = reps.split("-").map((p) => Number.parseInt(p.trim(), 10));
    if (
      parts.length === 2 &&
      !Number.isNaN(parts[0]) &&
      !Number.isNaN(parts[1])
    )
      return [parts[0], parts[1]];
    if (parts.length === 1 && !Number.isNaN(parts[0]))
      return [parts[0], parts[0]];
    return [8, 12]; // Default fallback
  }
}
