import prisma from "@kora/db";
import { PlanService } from "./services/plan.service";

async function verifyPersistence() {
  const service = new PlanService();
  const userId = "test-persistence-user-" + Date.now();

  console.log("🚀 Starting Persistence & Bloat Verification...");

  // 1. Create a "Bloated" plan input (144 days)
  console.log("📝 Creating a large plan (144 days)...");
  const largeDays = Array.from({ length: 144 }, (_, i) => ({
    dayNumber: i + 1,
    name: `Day ${i + 1}`,
    exercises: [
      { exerciseId: "1", sets: 3, reps: "10" } // Assuming ID 1 exists
    ]
  }));

  const plan = await service.createCustomPlan(userId, {
    name: "Bloat Test Plan",
    days: largeDays
  }) as any;

  console.log("✅ Plan creation call returned.");

  if (!plan) throw new Error("Plan creation failed");
  console.log(`✅ Plan Created. ID: ${plan.id}`);
  console.log(`📊 Sessions Count: ${plan.sessions?.length || 0} (Expected 144, not ${144 * 8})`);

  if ((plan.sessions?.length || 0) > 144) {
    console.error("❌ FAILURE: Plan is still bloated!");
    return;
  }

  // 2. Perform an update and check if it sticks
  console.log("🔄 Updating Day 1 exercise...");
  const updatedDays = [...largeDays];
  updatedDays[0] = {
    dayNumber: 1,
    name: "Day 1",
    exercises: [{ exerciseId: "2", sets: 5, reps: "5" }] 
  };

  const updatedPlan = await service.createCustomPlan(userId, {
    id: plan.id,
    name: "Bloat Test Plan",
    days: updatedDays
  }) as any;

  if (!updatedPlan) throw new Error("Plan update failed");

  const firstSession = updatedPlan.sessions.find((s: any) => s.dayNumber === 1 && s.week === 1);
  if (!firstSession) throw new Error("Session not found");
  
  const sets = (firstSession.planned as any).exercises[0].sets;
  console.log(`🧐 Day 1 Sets in DB: ${sets} (Expected 5)`);

  if (sets === 5) {
    console.log("🏆 SUCCESS: Plan updates are persisting correctly!");
  } else {
    console.error("❌ FAILURE: Plan update did not stick!");
  }
}

verifyPersistence().catch(console.error);
