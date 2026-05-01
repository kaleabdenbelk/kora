import prisma from "@kora/db";
import { PlanService } from "./services/plan.service";

interface ExerciseInPlan {
  exerciseId: string;
  name: string;
}

interface SessionInPlan {
  dayNumber: number;
  name: string;
  exercises: ExerciseInPlan[];
}

interface WeekInPlan {
  sessions: SessionInPlan[];
}

interface PlanJsonStructure {
  weeks: WeekInPlan[];
}

async function testGranularUpdateFlow() {
  console.log("🚀 Starting Granular Plan Day Update Verification Flow...");

  const planService = new PlanService();
  const testUserId = `test-user-patch-${Date.now()}`;

  // 1. Setup User
  console.log(`👤 Creating test user: ${testUserId}`);
  await prisma.user.create({
    data: {
      id: testUserId,
      email: `${testUserId}@example.com`,
      name: "Test User Patch",
    },
  });

  // 2. Initial Custom Plan
  console.log("📝 Creating initial 2-day plan...");
  const initialPlan = await planService.createCustomPlan(testUserId, {
    name: "Patch Test Plan",
    durationWeeks: 4,
    days: [
      {
        dayNumber: 1,
        name: "Monday Workout",
        exercises: [{ exerciseId: "1", sets: 3, reps: "10" }],
      },
      {
        dayNumber: 4,
        name: "Thursday Workout",
        exercises: [{ exerciseId: "2", sets: 3, reps: "10" }],
      },
    ],
  });

  const initialSessions = await prisma.userSession.findMany({
    where: { planId: initialPlan.id },
  });
  console.log(
    `📊 Initial Sessions Count: ${initialSessions.length} (Expected 8)`,
  );

  // 3. Granular Day Update (Only update Monday)
  console.log("🔄 Patching Day 1 (Monday) template...");

  const replacementEx = await prisma.exercise.findFirst({
    where: { isDeleted: false },
  });
  if (!replacementEx) throw new Error("Seed data missing");

  const updateResult = await planService.updateDayTemplate(
    testUserId,
    initialPlan.id,
    1, // Monday
    {
      dayNumber: 1,
      name: "Updated Monday",
      exercises: [
        {
          exerciseId: replacementEx.id,
          sets: 5,
          reps: "15",
          intensity: "High",
        },
      ],
    },
  );

  console.log(
    `✅ Patch completed. Updated ${updateResult.updatedSessions} individual sessions.`,
  );

  // 4. Verification
  console.log("🧐 Verifying surgical results...");

  // Check Plan Template
  const finalPlan = await prisma.userPlan.findUnique({
    where: { id: initialPlan.id },
  });
  const planJson = finalPlan?.planJson as unknown as PlanJsonStructure;
  const mondayTemplate = planJson.weeks[0].sessions.find(
    (s) => s.dayNumber === 1,
  );
  if (!mondayTemplate) throw new Error("Monday template not found in planJson");

  console.log(
    `✅ Plan Template for Day 1 updated: ${mondayTemplate.name === "Updated Monday"}`,
  );

  // Check Sessions
  const mondaySessions = await prisma.userSession.findMany({
    where: { planId: initialPlan.id, dayNumber: 1, isDeleted: false },
  });
  const allUpdated = mondaySessions.every(
    (s) => (s.planned as unknown as SessionInPlan).name === "Updated Monday",
  );
  console.log(`✅ All Monday sessions updated: ${allUpdated}`);

  const thursdaySessions = await prisma.userSession.findMany({
    where: { planId: initialPlan.id, dayNumber: 4, isDeleted: false },
  });
  const thursdayUntouched = thursdaySessions.every(
    (s) => (s.planned as unknown as SessionInPlan).name === "Thursday Workout",
  );
  console.log(`✅ Thursday sessions remained untouched: ${thursdayUntouched}`);

  if (
    mondayTemplate.name === "Updated Monday" &&
    allUpdated &&
    thursdayUntouched
  ) {
    console.log("🏆 SUCCESS: Granular update flow verified!");
  } else {
    console.error("❌ FAILURE: Verification failed.");
  }

  // Cleanup
  console.log("🧹 Cleaning up...");
  await prisma.user.delete({ where: { id: testUserId } });
  console.log("🏁 Done.");
}

testGranularUpdateFlow().catch(console.error);
