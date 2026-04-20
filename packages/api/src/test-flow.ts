import prisma from "@kora/db";
import { PlanService } from "./services/plan.service";

async function testFlow() {
  console.log("🚀 Starting Full Plan Customization Test Flow...");

  const planService = new PlanService();
  const testUserId = "test-user-" + Date.now();

  // 1. Create a dummy user and onboarding record
  // (Simulating the session creation as well)
  console.log(`👤 Creating test user: ${testUserId}`);
  await prisma.user.create({
    data: {
      id: testUserId,
      email: `${testUserId}@example.com`,
      name: "Test User",
    },
  });

  console.log("📝 Completing onboarding...");
  await prisma.onboarding.create({
    data: {
      userId: testUserId,
      goal: "HYPERTROPHY",
      trainingLevel: "BEGINNER",
      trainingDaysPerWeek: 3,
      gender: "MALE",
    },
  });

  // 2. Generate the AI plan (should be triggered by onboarding completion in the real app)
  console.log("🤖 Generating AI plan...");
  const initialPlan = await planService.generatePlan(testUserId);
  console.log(`✅ Plan generated: ${initialPlan.name} (Source: ${initialPlan.source})`);

  // 3. Search for a replacement exercise by name
  // This simulates the frontend search
  const searchQuery = "Dumbbell Chest Press";
  console.log(`🔍 Searching for exercise: "${searchQuery}"`);
  const foundExercises = await prisma.exercise.findMany({
    where: {
      name: { contains: searchQuery, mode: "insensitive" },
      isDeleted: false,
    },
    take: 1,
  });

  if (foundExercises.length === 0) {
    throw new Error(`Exercise "${searchQuery}" not found in database. Did you seed?`);
  }
  const replacementExercise = foundExercises[0];
  console.log(`🎯 Found: ${replacementExercise.name} (ID: ${replacementExercise.id})`);

  // 4. Get the active plan and its sessions to find an exercise to replace
  const activePlan = await planService.getActivePlan(testUserId);
  const firstSession = activePlan?.sessions[0];
  const oldExerciseId = (firstSession?.planned as any).exercises[0].exerciseId;
  const oldExerciseName = (firstSession?.planned as any).exercises[0].name;

  console.log(`🔄 Replacing "${oldExerciseName}" with "${replacementExercise.name}" in all future sessions...`);

  // 5. Replace the exercise
  const updateResult = await planService.replaceExercise(
    testUserId,
    initialPlan.id,
    oldExerciseId,
    replacementExercise.id,
    "all"
  );

  console.log(`✅ Update result: ${updateResult.updatedSessions} sessions updated.`);

  // 6. Verify the change in the database
  const refreshedPlan = await planService.getActivePlan(testUserId);
  const updatedSession = refreshedPlan?.sessions[0];
  const firstExercise = (updatedSession?.planned as any).exercises[0];

  if (firstExercise.exerciseId === replacementExercise.id) {
    console.log("✨ SUCCESS: The exercise was successfully replaced in the session plan!");
  } else {
    console.error("❌ FAILURE: Exercise ID doesn't match.");
  }

  // Cleanup
  console.log("🧹 Cleaning up test data...");
  await prisma.user.delete({ where: { id: testUserId } });
  console.log("🏁 Test flow complete.");
}

testFlow().catch((err) => {
  console.error("💥 Test failed:", err);
  process.exit(1);
});
