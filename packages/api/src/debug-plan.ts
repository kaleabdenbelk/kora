import prisma from "@kora/db";

interface ExerciseInPlan {
  name: string;
}

interface SessionInPlan {
  name: string;
  exercises: ExerciseInPlan[];
}

interface WeekInPlan {
  sessions: SessionInPlan[];
}

interface PlanJsonStructure {
  weeks: WeekInPlan[];
  programName?: string;
}

async function debugPlanPersistence() {
  const planId = "cmo5p4llx0e82wuijnausdzcw";
  const userId = "EMVSSX7dyB0aC9n46FBHWYpXmlV9JaQ6";

  console.log(`🔍 Inspecting Plan: ${planId} for User: ${userId}`);

  const plan = await prisma.userPlan.findUnique({
    where: { id: planId },
    include: {
      sessions: {
        where: { isDeleted: false },
        orderBy: [{ week: "asc" }, { dayNumber: "asc" }],
        take: 5,
      },
    },
  });

  if (!plan) {
    console.log("❌ Plan not found.");
    return;
  }

  console.log(`Plan Name: ${plan.name}`);
  console.log(`Is Active: ${plan.isActive}`);
  console.log(`Updated At: ${plan.updatedAt}`);

  const planJson = plan.planJson as unknown as PlanJsonStructure;
  if (planJson?.weeks) {
    console.log(`PlanJson Weeks Count: ${planJson.weeks.length}`);
    const firstDay = planJson.weeks[0].sessions[0];
    if (firstDay) {
      console.log(`First Day in PlanJson: ${firstDay.name}`);
      console.log(
        "Exercises in PlanJson (Day 1):",
        firstDay.exercises.map((e) => e.name),
      );
    }
  } else {
    console.log("⚠️ No weeks in planJson.");
  }

  console.log("\n📦 UserSessions (First 5):");
  for (const session of plan.sessions) {
    const planned = session.planned as unknown as SessionInPlan;
    console.log(
      `- Week ${session.week}, Day ${session.dayNumber}: ${planned.name}`,
    );
    console.log(
      "  Exercises:",
      planned.exercises.map((e) => e.name),
    );
  }
}

debugPlanPersistence().catch(console.error);
