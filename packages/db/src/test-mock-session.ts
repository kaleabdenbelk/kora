import prisma from "./index";

async function createMockSession() {
  console.log("🚀 Creating Mock Completed Session...");

  try {
    const TARGET_USER_ID = "0GFAoOd4be3UEZHuW324531V3eGX0V9f";
    const user = await prisma.user.findUnique({ where: { id: TARGET_USER_ID } });
    
    if (!user) {
      console.error(`❌ User with ID ${TARGET_USER_ID} not found. Ensure you are signed in.`);
      return;
    }
    console.log(`👤 Found User: ${user.name || user.email} (ID: ${user.id})`);

    let plan = await prisma.userPlan.findFirst({
      where: { userId: user.id, isActive: true, isDeleted: false },
    });

    if (!plan) {
      console.log("📝 Creating a dummy plan...");
      plan = await prisma.userPlan.create({
        data: {
          userId: user.id,
          name: "Analytics Test Plan",
          startDate: new Date(),
          isActive: true,
          source: "CUSTOM",
          planJson: {},
        },
      });
    }

    console.log("🏋️ Creating completed session...");
    const session = await prisma.userSession.create({
      data: {
        userId: user.id,
        planId: plan.id,
        dayNumber: 1,
        week: 1,
        planned: {},
        startedAt: new Date(Date.now() - 3600000),
        completedAt: new Date(),
        completedStatus: true,
        totalVolumeKg: 5000,
        totalDurationSeconds: 2700,
        activeMinutes: 45,
      },
    });

    console.log("📊 Adding exercise logs (Squat & Bench)...");
    await prisma.userExerciseLog.createMany({
      data: [
        {
          sessionId: session.id,
          exerciseId: "1", // Barbell Back Squat
          plannedSets: 3,
          plannedReps: "5",
          actualSets: 3,
          completed: true,
          weightsPerSet: [100, 100, 100],
          repsPerSet: [5, 5, 5],
        },
        {
          sessionId: session.id,
          exerciseId: "2", // Flat Barbell Bench Press
          plannedSets: 3,
          plannedReps: "10",
          actualSets: 3,
          completed: true,
          weightsPerSet: [60, 60, 60],
          repsPerSet: [10, 10, 10],
        },
      ],
    });

    console.log(`✅ SUCCESS: Created mock session ${session.id}`);
    console.log("📈 Now go to your analytics/dashboard and you should see real distribution percentages!");
  } catch (error) {
    console.error("❌ Error creating mock session:", error);
  }
}

createMockSession()
  .finally(() => prisma.$disconnect());
