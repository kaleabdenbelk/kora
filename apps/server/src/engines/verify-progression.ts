import { ProgressionEngine } from "./progression-engine";

// Standalone mock for verification that doesn't need @prisma/client
const prismaMock = {
  userExerciseLog: {
    findFirst: async (args: { where: { exerciseId?: string; [key: string]: unknown } }) => {
      console.log("\n[Mock] findFirst called for session/exercise search");

      // Default mock behavior: Return a successful history
      if (args.where.exerciseId === "struggle_ex") {
        return {
          repsPerSet: [12, 10, 8],
          weightsPerSet: [22.5, 22.5, 22.5],
          rpePerSet: [10, 10, 10],
          session: { fatigue: 6 },
        };
      }

      return {
        repsPerSet: [12, 12, 12],
        weightsPerSet: [20, 20, 20],
        rpePerSet: [8, 8, 8],
        session: { fatigue: 5 },
      };
    },
  },
// biome-ignore lint/suspicious/noExplicitAny: standalone verification script mock
} as any;

async function run() {
  const engine = new ProgressionEngine(prismaMock);

  console.log("=== Progression Engine Security & Logic Verification ===");

  try {
    console.log("\n--- Case 1: All sets hit max (Double Progression) ---");
    const result1 = await engine.calculateNextTargets("user1", "ex1", {
      plannedSets: 3,
      plannedReps: "8-12",
    });
    console.log("Result:", JSON.stringify(result1, null, 2));

    console.log("\n--- Case 2: High Fatigue (Capped/Safety) ---");
    const result2 = await engine.calculateNextTargets("user1", "ex1", {
      plannedSets: 3,
      plannedReps: "8-12",
      lastFatigue: 9,
    });
    console.log("Result:", JSON.stringify(result2, null, 2));

    console.log(
      "\n--- Case 3: Struggle/High Intensity (Deload Suggestion) ---",
    );
    const result3 = await engine.calculateNextTargets("user1", "struggle_ex", {
      plannedSets: 3,
      plannedReps: "8-12",
    });
    console.log("Result:", JSON.stringify(result3, null, 2));

    console.log("\n--- Case 4: Security Layer - Invalid Input Validation ---");
    try {
      await engine.calculateNextTargets("user1", "ex1", {
        plannedSets: -1, // Invalid
        plannedReps: "invalid", // Invalid
      });
    } catch (e: unknown) {
      console.log("Validation caught error as expected:", e instanceof Error ? e.message : e);
    }
  } catch (error) {
    console.error("Test failed unexpectedly:", error);
  }
}

run();
