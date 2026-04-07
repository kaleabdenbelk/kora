import { ProgressionEngine } from "@kora/api/engines/progression-engine";
import type { PrismaClient } from "@kora/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Prisma
const prismaMock = {
  userExerciseLog: {
    findFirst: vi.fn(),
  },
} as unknown as PrismaClient;

describe("ProgressionEngine", () => {
  let engine: ProgressionEngine;

  beforeEach(() => {
    engine = new ProgressionEngine(prismaMock);
    vi.clearAllMocks();
  });

  it("should return base targets if no history exists", async () => {
    vi.mocked(prismaMock.userExerciseLog.findFirst).mockResolvedValue(null);

    const result = await engine.calculateNextTargets("user1", "ex1", {
      plannedSets: 3,
      plannedReps: "8-12",
    });

    expect(result.weight).toBe(0);
    expect(result.reps).toBe("8-12");
    expect(result.note).toContain("Initial session");
  });

  it("should increase weight if max reps were hit and RPE is low", async () => {
    vi.mocked(prismaMock.userExerciseLog.findFirst).mockResolvedValue({
      repsPerSet: [12, 12, 12],
      weightsPerSet: [20, 20, 20],
      rpePerSet: [8, 8, 8],
      session: { fatigue: 5 },
    } as any);

    const result = await engine.calculateNextTargets("user1", "ex1", {
      plannedSets: 3,
      plannedReps: "8-12",
    });

    expect(result.weight).toBe(22.5);
    expect(result.reps).toBe("8-9"); // reset to low end + 1
    expect(result.note).toContain("Progressing to 22.5kg");
  });

  it("should maintain weight and focus on reps if some sets were below max", async () => {
    vi.mocked(prismaMock.userExerciseLog.findFirst).mockResolvedValue({
      repsPerSet: [12, 10, 8],
      weightsPerSet: [20, 20, 20],
      rpePerSet: [8, 9, 9],
      session: { fatigue: 5 },
    } as any);

    const result = await engine.calculateNextTargets("user1", "ex1", {
      plannedSets: 3,
      plannedReps: "8-12",
    });

    expect(result.weight).toBe(20);
    expect(result.reps).toBe("12-12"); // Best reps to max
    expect(result.note).toContain("Maintaining weight");
  });

  it("should maintain weight and focus on min reps if RPE is very high", async () => {
    vi.mocked(prismaMock.userExerciseLog.findFirst).mockResolvedValue({
      repsPerSet: [12, 12, 12],
      weightsPerSet: [20, 20, 20],
      rpePerSet: [10, 10, 10],
      session: { fatigue: 5 },
    } as any);

    const result = await engine.calculateNextTargets("user1", "ex1", {
      plannedSets: 3,
      plannedReps: "8-12",
    });

    expect(result.weight).toBe(20);
    expect(result.reps).toBe("8-8");
    expect(result.note).toContain("challenging");
  });

  it("should cap progression if high fatigue is detected", async () => {
    vi.mocked(prismaMock.userExerciseLog.findFirst).mockResolvedValue({
      repsPerSet: [12, 12, 12],
      weightsPerSet: [20, 20, 20],
      rpePerSet: [8, 8, 8],
      session: { fatigue: 9 },
    } as any);

    const result = await engine.calculateNextTargets("user1", "ex1", {
      plannedSets: 3,
      plannedReps: "8-12",
    });

    expect(result.weight).toBe(20);
    expect(result.note).toContain("High fatigue detected");
  });
});
