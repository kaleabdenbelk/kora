import prisma from "@kora/db";
import { PlanService } from "./services/plan.service";

async function testSurgicalUpdateFlow() {
  console.log("🚀 Starting Surgical Plan Update Verification Flow...");

  const planService = new PlanService();
  const testUserId = "test-user-" + Date.now();

  // 1. Setup User
  console.log(`👤 Creating test user: ${testUserId}`);
  await prisma.user.create({
    data: {
      id: testUserId,
      email: `${testUserId}@example.com`,
      name: "Test User",
    },
  });

  // 2. Initial Custom Plan Creation
  console.log("📝 Creating initial custom plan (2 days/week)...");
  const initialPlan = await planService.createCustomPlan(testUserId, {
    name: "Initial Plan",
    durationWeeks: 4,
    days: [
      {
        dayNumber: 1,
        name: "Upper Body",
        exercises: [{ exerciseId: "1", sets: 3, reps: "10" }],
      },
      {
        dayNumber: 3,
        name: "Lower Body",
        exercises: [{ exerciseId: "2", sets: 3, reps: "10" }],
      },
    ],
  });

  console.log(`✅ Plan created. ID: ${initialPlan.id}. Sessions: ${(initialPlan as any).sessions?.length || "fetching..."}`);
  
  const initialSessions = await prisma.userSession.findMany({ where: { planId: initialPlan.id, isDeleted: false } });
  console.log(`📊 Initial Sessions Count: ${initialSessions.length}`);

  // 3. Surgical Update
  console.log("🔄 Performing surgical update (updating Day 1, Adding Day 5, Deleting Day 3)...");
  
  // Searching for a real exercise to ensure validation passes
  const replacementEx = await prisma.exercise.findFirst({ where: { isDeleted: false } });
  if (!replacementEx) throw new Error("Seed data missing");

  await planService.createCustomPlan(testUserId, {
    id: initialPlan.id,
    name: "Updated Plan Name",
    durationWeeks: 4,
    days: [
      {
        dayNumber: 1,
        name: "Modified Upper Body",
        exercises: [{ exerciseId: replacementEx.id, sets: 4, reps: "12" }],
      },
      {
        dayNumber: 5,
        name: "New Friday Session",
        exercises: [{ exerciseId: replacementEx.id, sets: 3, reps: "15" }],
      },
    ],
  });

  // 4. Verification
  console.log("🧐 Verifying results...");

  const updatedPlan = await prisma.userPlan.findUnique({
    where: { id: initialPlan.id },
    include: { sessions: { where: { isDeleted: false } } }
  });

  if (!updatedPlan) throw new Error("Plan vanished!");
  
  console.log(`✅ Plan name updated: ${updatedPlan.name === "Updated Plan Name"}`);
  console.log(`📊 New Sessions Count: ${updatedPlan.sessions.length} (Expected 8: 2 sessions * 4 weeks)`);
  
  const day3Sessions = await prisma.userSession.findMany({
    where: { planId: initialPlan.id, dayNumber: 3, isDeleted: false }
  });
  console.log(`🗑️ Day 3 sessions deleted/hidden: ${day3Sessions.length === 0}`);

  const day1Session = updatedPlan.sessions.find(s => s.dayNumber === 1 && s.week === 1);
  const isSurgical = (day1Session?.planned as any).name === "Modified Upper Body";
  console.log(`✨ Day 1 session updated surgically: ${isSurgical}`);

  if (updatedPlan.sessions.length === 8 && day3Sessions.length === 0 && isSurgical) {
    console.log("🏆 SUCCESS: Surgical update flow verified!");
  } else {
    console.error("❌ FAILURE: Verification failed.");
  }

  // Cleanup
  console.log("🧹 Cleaning up...");
  await prisma.user.delete({ where: { id: testUserId } });
  console.log("🏁 Done.");
}

testSurgicalUpdateFlow().catch(console.error);
